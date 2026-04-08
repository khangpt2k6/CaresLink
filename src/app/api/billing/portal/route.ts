import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/clerk-auth";
import { prisma } from "@/lib/db";
import { getAppUrl, getStripeClient } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;

  try {
    const subscription = await prisma.userSubscription.findUnique({
      where: { userId: auth.user.id },
      select: { stripeCustomerId: true },
    });

    if (!subscription?.stripeCustomerId) {
      return NextResponse.json(
        { error: "No Stripe customer found for this account." },
        { status: 400 }
      );
    }

    const stripe = getStripeClient();
    const appUrl = getAppUrl();
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${appUrl}/settings?billing=portal-return`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Failed to create Stripe billing portal session:", error);
    return NextResponse.json({ error: "Failed to open billing portal." }, { status: 500 });
  }
}
