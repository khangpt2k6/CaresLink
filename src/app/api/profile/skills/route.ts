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

// POST /api/profile/skills — add skill
export async function POST(req: NextRequest) {
  const result = await requireUser(req);
  if (result.error) return result.error;

  const profileId = await getProfileId(result.user.id);
  const { name } = await req.json();

  if (!name?.trim()) {
    return NextResponse.json({ error: "Skill name is required" }, { status: 400 });
  }

  const skill = await prisma.skill.upsert({
    where: { profileId_name: { profileId, name: name.trim() } },
    create: { profileId, name: name.trim() },
    update: {},
  });

  return NextResponse.json(skill, { status: 201 });
}

// DELETE /api/profile/skills — delete skill
export async function DELETE(req: NextRequest) {
  const result = await requireUser(req);
  if (result.error) return result.error;

  const profileId = await getProfileId(result.user.id);
  const { id } = await req.json();

  const existing = await prisma.skill.findFirst({ where: { id, profileId } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.skill.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
