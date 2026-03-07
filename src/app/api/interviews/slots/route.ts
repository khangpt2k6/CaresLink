import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { findNextAvailableSlots } from "@/lib/scheduling";

export async function GET(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.AUTH_SECRET });
  if (!token?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (token.role !== "EMPLOYER") {
    return NextResponse.json({ error: "Only recruiters can view candidate availability for scheduling." }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const candidateId = searchParams.get("candidateId");

    if (!candidateId) {
      return NextResponse.json(
        { error: "candidateId is required" },
        { status: 400 }
      );
    }

    const slots = await findNextAvailableSlots(candidateId);
    return NextResponse.json({
      slots: slots.map((s) => s.toISOString()),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to fetch available slots" },
      { status: 500 }
    );
  }
}
