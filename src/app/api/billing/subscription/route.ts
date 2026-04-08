import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/clerk-auth";
import { getUserSubscription, hasPremiumAccess } from "@/lib/subscription";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;

  try {
    const [subscription, premium] = await Promise.all([
      getUserSubscription(auth.user.id),
      hasPremiumAccess(auth.user.id),
    ]);

    return NextResponse.json({
      premium,
      subscription: subscription
        ? {
            status: subscription.status,
            premiumUntil: subscription.premiumUntil,
            currentPeriodEnd: subscription.currentPeriodEnd,
          }
        : null,
    });
  } catch (error) {
    console.error("Failed to fetch subscription status:", error);
    return NextResponse.json({ error: "Failed to fetch subscription status." }, { status: 500 });
  }
}
