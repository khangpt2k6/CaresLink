import { NextRequest, NextResponse } from "next/server";
import { requireCandidate } from "@/lib/clerk-auth";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const auth = await requireCandidate(req);
  if ("error" in auth) return auth.error;

  try {
    const profile = await prisma.candidateProfile.findUnique({
      where: { userId: auth.user.id },
      include: { preferences: true },
    });

    const prefs = profile?.preferences;
    const openJobs = await prisma.job.findMany({ where: { status: "open" } });

    // Match jobs against preferences
    const matchingJobs = openJobs.filter((job) => {
      if (!prefs) return true; // no prefs = apply to all

      const titleLower = job.title.toLowerCase();
      const typeLower = job.type.toLowerCase();

      const roleMatch =
        !prefs.roles.length ||
        prefs.roles.some((r) => titleLower.includes(r.toLowerCase().split(" ")[0]));

      const typeMatch =
        !prefs.jobTypes.length ||
        prefs.jobTypes.some((t) => typeLower.includes(t.toLowerCase()));

      return roleMatch || typeMatch;
    });

    const applied: string[] = [];
    const skipped: string[] = [];

    for (const job of matchingJobs) {
      // Skip if already applied
      const existing = await prisma.candidate.findFirst({
        where: { email: auth.user.email, position: job.title },
      });
      if (existing) { skipped.push(job.title); continue; }

      await prisma.candidate.create({
        data: {
          name: auth.user.name ?? auth.user.email.split("@")[0],
          email: auth.user.email,
          phone: profile?.phone ?? null,
          position: job.title,
          status: "applied",
          appliedAt: new Date(),
          autoApplied: true,
        },
      });
      applied.push(job.title);
    }

    return NextResponse.json({ applied, skipped, total: applied.length });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Auto-apply failed" }, { status: 500 });
  }
}
