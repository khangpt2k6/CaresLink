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

// POST /api/profile/licenses — add license
export async function POST(req: NextRequest) {
  const result = await requireUser(req);
  if (result.error) return result.error;

  const profileId = await getProfileId(result.user.id);
  const { type, licenseNumber, licenseState, boardName, status, issueDate, expiryDate } = await req.json();

  if (!type?.trim() || !licenseNumber?.trim() || !licenseState?.trim()) {
    return NextResponse.json(
      { error: "License type, number, and state are required" },
      { status: 400 }
    );
  }

  const license = await prisma.license.create({
    data: {
      profileId,
      type: type.trim(),
      licenseNumber: licenseNumber.trim(),
      licenseState: licenseState.trim().toUpperCase(),
      boardName: boardName || null,
      status: status || null,
      issueDate: issueDate ? new Date(issueDate) : null,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
    },
  });

  return NextResponse.json(license, { status: 201 });
}

// PUT /api/profile/licenses — update license
export async function PUT(req: NextRequest) {
  const result = await requireUser(req);
  if (result.error) return result.error;

  const profileId = await getProfileId(result.user.id);
  const { id, type, licenseNumber, licenseState, boardName, status, issueDate, expiryDate } = await req.json();

  if (!id) {
    return NextResponse.json({ error: "License ID is required" }, { status: 400 });
  }

  const existing = await prisma.license.findFirst({ where: { id, profileId } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const license = await prisma.license.update({
    where: { id },
    data: {
      ...(type !== undefined && { type: type.trim() }),
      ...(licenseNumber !== undefined && { licenseNumber: licenseNumber.trim() }),
      ...(licenseState !== undefined && { licenseState: licenseState.trim().toUpperCase() }),
      ...(boardName !== undefined && { boardName: boardName || null }),
      ...(status !== undefined && { status: status || null }),
      ...(issueDate !== undefined && { issueDate: issueDate ? new Date(issueDate) : null }),
      ...(expiryDate !== undefined && { expiryDate: expiryDate ? new Date(expiryDate) : null }),
    },
  });

  return NextResponse.json(license);
}

// DELETE /api/profile/licenses — delete license
export async function DELETE(req: NextRequest) {
  const result = await requireUser(req);
  if (result.error) return result.error;

  const profileId = await getProfileId(result.user.id);
  const { id } = await req.json();

  const existing = await prisma.license.findFirst({ where: { id, profileId } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.license.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
