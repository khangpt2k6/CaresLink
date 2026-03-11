import { NextRequest, NextResponse } from "next/server";
import { requireEmployer } from "@/lib/clerk-auth";
import { sendBookingLinkToCandidate } from "@/lib/send-booking-link";

/** Direct send booking link — no AI, uses template with candidate data. */
export async function POST(request: NextRequest) {
  const auth = await requireEmployer(request);
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const { candidateId } = body;
    if (!candidateId) {
      return NextResponse.json({ error: "candidateId required" }, { status: 400 });
    }

    const result = await sendBookingLinkToCandidate(candidateId);
    if (result.success) {
      return NextResponse.json({ success: true, booking_url: result.booking_url });
    }
    return NextResponse.json(
      { error: result.error, already_scheduled: result.already_scheduled },
      { status: result.already_scheduled ? 400 : 500 }
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to send booking link" }, { status: 500 });
  }
}
