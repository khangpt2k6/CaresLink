import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const position = searchParams.get("position") || undefined;
    const status = searchParams.get("status") || undefined;

    const candidates = await prisma.candidate.findMany({
      where: {
        ...(position && { position }),
        ...(status && { status }),
      },
      orderBy: { appliedAt: "desc" },
      include: {
        interviews: { where: { completed: false, noShow: false }, orderBy: { scheduledAt: "asc" } },
      },
    });
    return NextResponse.json(candidates);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch candidates" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, phone, position } = body;
    if (!name || !email || !position) {
      return NextResponse.json(
        { error: "name, email, and position are required" },
        { status: 400 }
      );
    }

    const candidate = await prisma.candidate.create({
      data: { name, email, phone: phone || null, position },
    });
    return NextResponse.json(candidate);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create candidate" }, { status: 500 });
  }
}
