import { NextRequest, NextResponse } from "next/server";
import { requireCandidate } from "@/lib/clerk-auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const auth = await requireCandidate(req);
  if ("error" in auth) return auth.error;

  const profile = await prisma.candidateProfile.findUnique({
    where: { userId: auth.user.id },
    include: { preferences: true },
  });

  return NextResponse.json({ preferences: profile?.preferences ?? null });
}

export async function POST(req: NextRequest) {
  const auth = await requireCandidate(req);
  if ("error" in auth) return auth.error;

  const { roles, businessUnits, jobTypes, shifts } = await req.json();

  // Ensure profile exists
  let profile = await prisma.candidateProfile.findUnique({
    where: { userId: auth.user.id },
  });
  if (!profile) {
    profile = await prisma.candidateProfile.create({
      data: { userId: auth.user.id },
    });
  }

  const preferences = await prisma.jobPreferences.upsert({
    where: { profileId: profile.id },
    create: {
      profileId: profile.id,
      roles: roles ?? [],
      businessUnits: businessUnits ?? [],
      jobTypes: jobTypes ?? [],
      shifts: shifts ?? [],
    },
    update: {
      roles: roles ?? [],
      businessUnits: businessUnits ?? [],
      jobTypes: jobTypes ?? [],
      shifts: shifts ?? [],
    },
  });

  return NextResponse.json({ preferences });
}
