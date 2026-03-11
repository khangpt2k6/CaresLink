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

// POST /api/profile/education — add education
export async function POST(req: NextRequest) {
  const result = await requireUser(req);
  if (result.error) return result.error;

  const profileId = await getProfileId(result.user.id);
  const { school, degree, field, startDate, endDate } = await req.json();

  if (!school) {
    return NextResponse.json({ error: "School is required" }, { status: 400 });
  }

  const education = await prisma.education.create({
    data: {
      profileId,
      school,
      degree: degree || null,
      field: field || null,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
    },
  });

  return NextResponse.json(education, { status: 201 });
}

// PUT /api/profile/education — update education
export async function PUT(req: NextRequest) {
  const result = await requireUser(req);
  if (result.error) return result.error;

  const profileId = await getProfileId(result.user.id);
  const { id, school, degree, field, startDate, endDate } = await req.json();

  if (!id) {
    return NextResponse.json({ error: "Education ID is required" }, { status: 400 });
  }

  const existing = await prisma.education.findFirst({ where: { id, profileId } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const education = await prisma.education.update({
    where: { id },
    data: {
      ...(school !== undefined && { school }),
      ...(degree !== undefined && { degree: degree || null }),
      ...(field !== undefined && { field: field || null }),
      ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
      ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
    },
  });

  return NextResponse.json(education);
}

// DELETE /api/profile/education — delete education
export async function DELETE(req: NextRequest) {
  const result = await requireUser(req);
  if (result.error) return result.error;

  const profileId = await getProfileId(result.user.id);
  const { id } = await req.json();

  const existing = await prisma.education.findFirst({ where: { id, profileId } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.education.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
