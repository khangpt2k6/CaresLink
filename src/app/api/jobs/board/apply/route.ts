import { NextRequest, NextResponse } from "next/server";
import { requireCandidate } from "@/lib/clerk-auth";
import { prisma } from "@/lib/db";

export async function DELETE(req: NextRequest) {
  const auth = await requireCandidate(req);
  if ("error" in auth) return auth.error;

  try {
    const { jobId } = await req.json();
    if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    const existing = await prisma.candidate.findFirst({
      where: { email: auth.user.email, position: job.title },
    });
    if (!existing) return NextResponse.json({ error: "No application found" }, { status: 404 });

    await prisma.candidate.delete({ where: { id: existing.id } });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to cancel application" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireCandidate(req);
  if ("error" in auth) return auth.error;

  try {
    const { jobId } = await req.json();
    if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    if (job.status !== "open") return NextResponse.json({ error: "Job is no longer open" }, { status: 400 });

    // Check for duplicate application
    const existing = await prisma.candidate.findFirst({
      where: { email: auth.user.email, position: job.title },
    });
    if (existing) return NextResponse.json({ error: "Already applied" }, { status: 409 });

    // Pull profile data to pre-fill the candidate record
    const profile = await prisma.candidateProfile.findUnique({
      where: { userId: auth.user.id },
    });

    const candidate = await prisma.candidate.create({
      data: {
        name: auth.user.name ?? auth.user.email.split("@")[0],
        email: auth.user.email,
        phone: profile?.phone ?? null,
        position: job.title,
        status: "applied",
        appliedAt: new Date(),
      },
    });

    return NextResponse.json({ candidate });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to apply" }, { status: 500 });
  }
}
