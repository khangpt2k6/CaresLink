import { NextRequest, NextResponse } from "next/server";
import { requireEmployer } from "@/lib/clerk-auth";
import { prisma } from "@/lib/db";
import { embedJob } from "@/lib/embeddings";

export async function GET(request: NextRequest) {
  const auth = await requireEmployer(request);
  if ("error" in auth) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;

    const jobs = await prisma.job.findMany({
      where: { ...(status && { status }) },
      orderBy: { createdAt: "desc" },
    });

    // Attach candidate count per job (matched by position title)
    const candidateCounts = await prisma.candidate.groupBy({
      by: ["position"],
      _count: { id: true },
    });
    const countMap = Object.fromEntries(
      candidateCounts.map((c) => [c.position.toLowerCase(), c._count.id])
    );

    const jobsWithCounts = jobs.map((job) => ({
      ...job,
      candidateCount: countMap[job.title.toLowerCase()] ?? 0,
    }));

    return NextResponse.json(jobsWithCounts);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch jobs" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireEmployer(request);
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const { title, department, location, type, description } = body;
    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const job = await prisma.job.create({
      data: {
        title,
        department: department || null,
        location: location || "Remote",
        type: type || "Full-time",
        description: description || null,
      },
    });
    void embedJob(job.id);
    return NextResponse.json(job);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create job" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireEmployer(request);
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const { id, title, department, location, type, description, status } = body;
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const job = await prisma.job.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(department !== undefined && { department: department || null }),
        ...(location !== undefined && { location }),
        ...(type !== undefined && { type }),
        ...(description !== undefined && { description: description || null }),
        ...(status !== undefined && { status }),
      },
    });
    void embedJob(job.id);
    return NextResponse.json(job);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to update job" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireEmployer(request);
  if ("error" in auth) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    await prisma.job.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to delete job" }, { status: 500 });
  }
}
