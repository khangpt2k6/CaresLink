import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/clerk-auth";
import { getAiAccessSnapshot, getUserSubscription, hasPremiumAccess } from "@/lib/subscription";
import { getPlanFromPriceId } from "@/lib/stripe";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;

  try {
    const [subscription, premium, aiAccess] = await Promise.all([
      getUserSubscription(auth.user.id),
      hasPremiumAccess(auth.user.id),
      getAiAccessSnapshot(auth.user.id),
    ]);

    return NextResponse.json({
      premium,
      plan: premium ? getPlanFromPriceId(subscription?.stripePriceId) : "free",
      aiAccess,
      subscription: subscription
        ? {
            status: subscription.status,
            premiumUntil: subscription.premiumUntil,
            currentPeriodEnd: subscription.currentPeriodEnd,
            canManage: Boolean(subscription.stripeCustomerId),
          }
        : null,
    });
  } catch (error) {
    console.error("Failed to fetch subscription status:", error);
    return NextResponse.json({ error: "Failed to fetch subscription status." }, { status: 500 });
  }
}
