import { NextRequest, NextResponse } from "next/server";
import { requireEmployer } from "@/lib/clerk-auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/credential-check/candidates
 * Returns existing candidates from both:
 *   1. The Candidate table (employer pipeline)
 *   2. Users with CANDIDATE role who have profiles (candidate-side signups)
 * Merged and deduplicated by email.
 */
export async function GET(request: NextRequest) {
  const auth = await requireEmployer(request);
  if ("error" in auth) return auth.error;

  try {
    // 1. Fetch pipeline candidates (Candidate model)
    const pipelineCandidates = await prisma.candidate.findMany({
      orderBy: { appliedAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        position: true,
      },
    });

    // 2. Fetch registered candidate users with profiles + certifications
    const registeredCandidates = await prisma.user.findMany({
      where: {
        role: "CANDIDATE",
        profile: { isNot: null },
      },
      select: {
        id: true,
        name: true,
        email: true,
        profile: {
          select: {
            phone: true,
            state: true,
            certifications: {
              select: { name: true },
            },
          },
        },
      },
    });

    // Build a merged list, keyed by email to deduplicate
    const seen = new Map<string, MergedCandidate>();

    // Add pipeline candidates first
    for (const c of pipelineCandidates) {
      const { firstName, lastName } = splitName(c.name);
      const key = c.email.toLowerCase();
      seen.set(key, {
        source: "pipeline",
        id: c.id,
        firstName,
        lastName,
        email: c.email,
        phone: c.phone || null,
        position: c.position,
        roleType: inferRoleType(c.position),
        licenseState: null,
      });
    }

    // Merge/add registered candidates
    for (const u of registeredCandidates) {
      const key = u.email.toLowerCase();
      const { firstName, lastName } = splitName(u.name || "");
      const certNames = u.profile?.certifications.map((c) => c.name) || [];
      const roleType = inferRoleTypeFromCerts(certNames);

      if (seen.has(key)) {
        // Enrich existing pipeline entry with profile data
        const existing = seen.get(key)!;
        existing.source = "both";
        if (!existing.phone && u.profile?.phone) existing.phone = u.profile.phone;
        if (!existing.licenseState && u.profile?.state) existing.licenseState = u.profile.state;
        if (roleType) existing.roleType = roleType;
      } else {
        seen.set(key, {
          source: "registered",
          id: u.id,
          firstName,
          lastName,
          email: u.email,
          phone: u.profile?.phone || null,
          position: null,
          roleType: roleType || "CNA",
          licenseState: u.profile?.state || null,
        });
      }
    }

    return NextResponse.json(Array.from(seen.values()));
  } catch (e) {
    console.error("Failed to fetch candidates for credential check:", e);
    return NextResponse.json({ error: "Failed to fetch candidates" }, { status: 500 });
  }
}

interface MergedCandidate {
  source: "pipeline" | "registered" | "both";
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  position: string | null;
  roleType: "NURSE" | "CNA";
  licenseState: string | null;
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function inferRoleType(position: string | null): "NURSE" | "CNA" {
  if (!position) return "CNA";
  const p = position.toLowerCase();
  if (p.includes("rn") || p.includes("nurse") || p.includes("lpn") || p.includes("registered")) return "NURSE";
  return "CNA";
}

function inferRoleTypeFromCerts(certs: string[]): "NURSE" | "CNA" | null {
  for (const c of certs) {
    const lower = c.toLowerCase();
    if (lower.includes("rn") || lower.includes("registered nurse") || lower.includes("lpn")) return "NURSE";
    if (lower.includes("cna") || lower.includes("certified nursing assistant")) return "CNA";
  }
  return null;
}
