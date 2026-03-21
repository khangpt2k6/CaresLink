import { NextRequest, NextResponse } from "next/server";
import { requireEmployer } from "@/lib/clerk-auth";
import { prisma } from "@/lib/db";
import { embedCandidate } from "@/lib/embeddings";

export async function PUT(request: NextRequest) {
  const auth = await requireEmployer(request);
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const { id, name, email, phone, position, status, fitStatus } = body;
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const candidate = await prisma.candidate.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone: phone || null }),
        ...(position !== undefined && { position }),
        ...(status !== undefined && { status }),
        ...(fitStatus !== undefined && { fitStatus: fitStatus || null }),
      },
    });
    void embedCandidate(candidate.id);
    return NextResponse.json(candidate);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to update candidate" }, { status: 500 });
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

    await prisma.event.deleteMany({ where: { candidateId: id } });
    await prisma.interview.deleteMany({ where: { candidateId: id } });
    await prisma.candidate.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to delete candidate" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireEmployer(request);
  if ("error" in auth) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const position = searchParams.get("position") || undefined;
    const status = searchParams.get("status") || undefined;

    const candidates = await prisma.candidate.findMany({
      where: {
        ...(position && { position }),
        ...(status && { status }),
      },
      orderBy: { appliedAt: "desc" },
      include: {
        interviews: { where: { completed: false, noShow: false }, orderBy: { scheduledAt: "asc" } },
      },
    });

    // Pin these emails to top
    const pinnedEmails = ["2006tuankhang@gmail.com", "kphan2729@gmail.com"].map((e) => e.toLowerCase());
    const sorted = [...candidates].sort((a, b) => {
      const aIdx = pinnedEmails.indexOf(a.email.toLowerCase());
      const bIdx = pinnedEmails.indexOf(b.email.toLowerCase());
      if (aIdx >= 0 && bIdx >= 0) return aIdx - bIdx;
      if (aIdx >= 0) return -1;
      if (bIdx >= 0) return 1;
      return 0;
    });

    return NextResponse.json(sorted);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch candidates" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireEmployer(request);
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const { name, email, phone, position } = body;
    if (!name || !email || !position) {
      return NextResponse.json(
        { error: "name, email, and position are required" },
        { status: 400 }
      );
    }

    const candidate = await prisma.candidate.create({
      data: { name, email, phone: phone || null, position },
    });
    void embedCandidate(candidate.id);
    return NextResponse.json(candidate);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create candidate" }, { status: 500 });
  }
}
