import { NextRequest, NextResponse } from "next/server";
import { requireEmployer } from "@/lib/clerk-auth";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireEmployer(request);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;

    const candidate = await prisma.candidate.findUnique({
      where: { id },
      include: {
        interviews: {
          orderBy: { scheduledAt: "desc" },
        },
        events: {
          orderBy: { createdAt: "desc" },
          take: 50,
        },
      },
    });

    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    // Look up the candidate's profile via their email -> User -> CandidateProfile
    const user = await prisma.user.findUnique({
      where: { email: candidate.email },
      include: {
        profile: {
          include: {
            experiences: { orderBy: { startDate: "desc" } },
            educations: { orderBy: { startDate: "desc" } },
            skills: true,
            certifications: { orderBy: { issueDate: "desc" } },
            licenses: { orderBy: { createdAt: "desc" } },
          },
        },
      },
    });

    return NextResponse.json({
      ...candidate,
      profile: user?.profile || null,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch candidate" }, { status: 500 });
  }
}
