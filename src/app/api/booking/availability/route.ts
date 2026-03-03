import { NextRequest, NextResponse } from "next/server";
import { findPublicAvailableSlots } from "@/lib/scheduling";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get("month");

    if (!monthParam || !/^\d{4}-\d{2}$/.test(monthParam)) {
      return NextResponse.json(
        { error: "month parameter required in YYYY-MM format" },
        { status: 400 }
      );
    }

    const [yearStr, monthStr] = monthParam.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10) - 1;

    const slots = await findPublicAvailableSlots(month, year);

    const slotsByDate: Record<string, string[]> = {};
    for (const slot of slots) {
      const dateKey = slot.toISOString().split("T")[0];
      if (!slotsByDate[dateKey]) slotsByDate[dateKey] = [];
      slotsByDate[dateKey].push(slot.toISOString());
    }

    return NextResponse.json({
      month: monthParam,
      availableDates: Object.keys(slotsByDate),
      slotsByDate,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to fetch availability" },
      { status: 500 }
    );
  }
}
