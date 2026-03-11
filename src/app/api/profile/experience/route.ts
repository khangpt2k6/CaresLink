import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/clerk-auth";
import { prisma } from "@/lib/db";

async function getProfileId(userId: string) {
  const profile = await prisma.candidateProfile.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
  return profile.id;
}

// POST /api/profile/experience — add experience
export async function POST(req: NextRequest) {
  const result = await requireUser(req);
  if (result.error) return result.error;

  const profileId = await getProfileId(result.user.id);
  const { title, company, description, startDate, endDate, current } = await req.json();

  if (!title || !company || !startDate) {
    return NextResponse.json({ error: "Title, company, and start date are required" }, { status: 400 });
  }

  const experience = await prisma.experience.create({
    data: {
      profileId,
      title,
      company,
      description: description || null,
      startDate: new Date(startDate),
      endDate: current ? null : endDate ? new Date(endDate) : null,
      current: !!current,
    },
  });

  return NextResponse.json(experience, { status: 201 });
}

// PUT /api/profile/experience — update experience
export async function PUT(req: NextRequest) {
  const result = await requireUser(req);
  if (result.error) return result.error;

  const profileId = await getProfileId(result.user.id);
  const { id, title, company, description, startDate, endDate, current } = await req.json();

  if (!id) {
    return NextResponse.json({ error: "Experience ID is required" }, { status: 400 });
  }

  // Verify ownership
  const existing = await prisma.experience.findFirst({ where: { id, profileId } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const experience = await prisma.experience.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(company !== undefined && { company }),
      ...(description !== undefined && { description: description || null }),
      ...(startDate !== undefined && { startDate: new Date(startDate) }),
      ...(current !== undefined && { current: !!current }),
      endDate: current ? null : endDate ? new Date(endDate) : null,
    },
  });

  return NextResponse.json(experience);
}

// DELETE /api/profile/experience — delete experience
export async function DELETE(req: NextRequest) {
  const result = await requireUser(req);
  if (result.error) return result.error;

  const profileId = await getProfileId(result.user.id);
  const { id } = await req.json();

  const existing = await prisma.experience.findFirst({ where: { id, profileId } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.experience.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
