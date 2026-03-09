import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const runs = await prisma.agentRun.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      trigger: true,
      report: true,
      startedAt: true,
      completedAt: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ runs });
}
