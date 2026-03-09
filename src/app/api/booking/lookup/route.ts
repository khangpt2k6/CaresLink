import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/** Public lookup: fetch candidate by email for booking form prefill (phone, position from DB) */
export async function GET(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get("email")?.trim();
    if (!email) {
      return NextResponse.json({ found: false }, { status: 200 });
    }

    const candidate = await prisma.candidate.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true, name: true, email: true, phone: true, position: true },
    });

    if (!candidate) {
      return NextResponse.json({ found: false }, { status: 200 });
    }

    return NextResponse.json({
      found: true,
      candidate: {
        id: candidate.id,
        name: candidate.name,
        email: candidate.email,
        phone: candidate.phone,
        position: candidate.position,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ found: false }, { status: 200 });
  }
}
