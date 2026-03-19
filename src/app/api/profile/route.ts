import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/clerk-auth";
import { prisma } from "@/lib/db";

// GET /api/profile — get current user's candidate profile
export async function GET(req: NextRequest) {
  const result = await requireUser(req);
  if (result.error) return result.error;
  const { user } = result;

  const profile = await prisma.candidateProfile.findUnique({
    where: { userId: user.id },
    include: {
      experiences: { orderBy: { startDate: "desc" } },
      educations: { orderBy: { endDate: "desc" } },
      skills: { orderBy: { createdAt: "asc" } },
      certifications: { orderBy: { issueDate: "desc" } },
    },
  });

  return NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, image: user.image, role: user.role },
    profile,
  });
}

// PUT /api/profile — update profile info (headline, summary, location, phone)
export async function PUT(req: NextRequest) {
  const result = await requireUser(req);
  if (result.error) return result.error;
  const { user } = result;

  const body = await req.json();
  const { name, headline, summary, phone, city, state, country, resumeTemplate } = body;

  // Update user name if provided
  if (name !== undefined) {
    await prisma.user.update({
      where: { id: user.id },
      data: { name },
    });
  }

  const profile = await prisma.candidateProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      headline,
      summary,
      phone,
      city,
      state,
      country,
    },
    update: {
      ...(headline !== undefined && { headline }),
      ...(summary !== undefined && { summary }),
      ...(phone !== undefined && { phone }),
      ...(city !== undefined && { city }),
      ...(state !== undefined && { state }),
      ...(country !== undefined && { country }),
      ...(resumeTemplate !== undefined && { resumeTemplate }),
    },
    include: {
      experiences: { orderBy: { startDate: "desc" } },
      educations: { orderBy: { endDate: "desc" } },
      skills: { orderBy: { createdAt: "asc" } },
      certifications: { orderBy: { issueDate: "desc" } },
    },
  });

  return NextResponse.json({ profile });
}
