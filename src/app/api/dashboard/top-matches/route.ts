import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const matches = await prisma.jobMatch.findMany({
      where: { score: { gte: 50 } },
      include: {
        candidate: { select: { name: true, position: true } },
        job: { select: { title: true } },
      },
      orderBy: { score: "desc" },
      take: 5,
    });

    const result = matches.map((m) => ({
      candidateName: m.candidate.name,
      candidatePosition: m.candidate.position,
      score: m.score,
      label: m.label,
      reason: m.reason,
      jobTitle: m.job.title,
    }));

    return NextResponse.json(result);
  } catch {
    return NextResponse.json([]);
  }
}
