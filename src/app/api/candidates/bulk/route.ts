import { NextRequest, NextResponse } from "next/server";
import { requireEmployer } from "@/lib/clerk-auth";
import { prisma } from "@/lib/db";

const MAX_BULK = 20;

export async function POST(request: NextRequest) {
  const auth = await requireEmployer(request);
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const rows = Array.isArray(body.candidates) ? body.candidates : body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: "candidates array required (max 20)" },
        { status: 400 }
      );
    }
    if (rows.length > MAX_BULK) {
      return NextResponse.json(
        { error: `Maximum ${MAX_BULK} candidates per bulk add` },
        { status: 400 }
      );
    }

    const created: { id: string; name: string; email: string; position: string }[] = [];
    const skipped: { email: string; reason: string }[] = [];

    for (const row of rows) {
      const name = typeof row.name === "string" ? row.name.trim() : "";
      const email = typeof row.email === "string" ? row.email.trim().toLowerCase() : "";
      const position = typeof row.position === "string" ? row.position.trim() || "General" : "General";
      const phone = typeof row.phone === "string" ? row.phone.trim() || null : null;

      if (!name || !email) {
        skipped.push({ email: email || "(empty)", reason: "name and email required" });
        continue;
      }

      const existing = await prisma.candidate.findFirst({ where: { email } });
      if (existing) {
        skipped.push({ email, reason: "already exists" });
        continue;
      }

      const c = await prisma.candidate.create({
        data: { name, email, phone, position },
      });
      created.push({ id: c.id, name: c.name, email: c.email, position: c.position });
    }

    return NextResponse.json({
      created: created.length,
      skipped: skipped.length,
      candidates: created,
      skippedDetails: skipped,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to add candidates" }, { status: 500 });
  }
}
