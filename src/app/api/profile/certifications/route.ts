import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/clerk-auth";
import { prisma } from "@/lib/db";
import { reembedCandidateByUserId } from "@/lib/embeddings";

async function getProfileId(userId: string) {
  const profile = await prisma.candidateProfile.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
  return profile.id;
}

// POST /api/profile/certifications — add certification
export async function POST(req: NextRequest) {
  const result = await requireUser(req);
  if (result.error) return result.error;

  const profileId = await getProfileId(result.user.id);
  const { name, issuer, issueDate, expiryDate } = await req.json();

  if (!name?.trim()) {
    return NextResponse.json({ error: "Certification name is required" }, { status: 400 });
  }

  const cert = await prisma.certification.create({
    data: {
      profileId,
      name: name.trim(),
      issuer: issuer || null,
      issueDate: issueDate ? new Date(issueDate) : null,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
    },
  });

  void reembedCandidateByUserId(result.user.id);
  return NextResponse.json(cert, { status: 201 });
}

// PUT /api/profile/certifications — update certification
export async function PUT(req: NextRequest) {
  const result = await requireUser(req);
  if (result.error) return result.error;

  const profileId = await getProfileId(result.user.id);
  const { id, name, issuer, issueDate, expiryDate } = await req.json();

  if (!id) {
    return NextResponse.json({ error: "Certification ID is required" }, { status: 400 });
  }

  const existing = await prisma.certification.findFirst({ where: { id, profileId } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const cert = await prisma.certification.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(issuer !== undefined && { issuer: issuer || null }),
      ...(issueDate !== undefined && { issueDate: issueDate ? new Date(issueDate) : null }),
      ...(expiryDate !== undefined && { expiryDate: expiryDate ? new Date(expiryDate) : null }),
    },
  });

  void reembedCandidateByUserId(result.user.id);
  return NextResponse.json(cert);
}

// DELETE /api/profile/certifications — delete certification
export async function DELETE(req: NextRequest) {
  const result = await requireUser(req);
  if (result.error) return result.error;

  const profileId = await getProfileId(result.user.id);
  const { id } = await req.json();

  const existing = await prisma.certification.findFirst({ where: { id, profileId } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.certification.delete({ where: { id } });
  void reembedCandidateByUserId(result.user.id);
  return NextResponse.json({ success: true });
}
