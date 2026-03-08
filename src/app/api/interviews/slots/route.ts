import { NextRequest, NextResponse } from "next/server";
import { requireEmployer } from "@/lib/clerk-auth";
import { findNextAvailableSlots } from "@/lib/scheduling";

export async function GET(request: NextRequest) {
  const result = await requireEmployer(request);
  if (result.error) return result.error;

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
