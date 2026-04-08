import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/clerk-auth";
import { prisma } from "@/lib/db";
import { getAppUrl, getStripeClient, getStripePriceId, type BillingPlan } from "@/lib/stripe";

const NON_TERMINAL_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "incomplete",
]);

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;

  try {
    let plan: BillingPlan = "starter";
    try {
      const body = await request.json();
      if (body?.plan === "pro" || body?.plan === "starter") {
        plan = body.plan;
      }
    } catch {
      // Body is optional for backward-compatible clients.
    }

    const user = auth.user;
    const stripe = getStripeClient();
    const appUrl = getAppUrl();
    const priceId = getStripePriceId(plan);

    const existing = await prisma.userSubscription.findUnique({
      where: { userId: user.id },
    });

    const customerId = existing?.stripeCustomerId
      ? existing.stripeCustomerId
      : (
          await stripe.customers.create({
            email: user.email,
            name: user.name || undefined,
            metadata: { userId: user.id },
          })
        ).id;

    if (!existing?.stripeCustomerId) {
      await prisma.userSubscription.upsert({
        where: { userId: user.id },
        update: { stripeCustomerId: customerId },
        create: { userId: user.id, stripeCustomerId: customerId, status: "inactive" },
      });
    }

    // If user already has a non-terminal subscription, send them to billing portal instead.
    if (existing?.stripeSubscriptionId) {
      const currentSub = await stripe.subscriptions.retrieve(existing.stripeSubscriptionId).catch(() => null);
      if (currentSub && NON_TERMINAL_SUBSCRIPTION_STATUSES.has(currentSub.status)) {
        const portal = await stripe.billingPortal.sessions.create({
          customer: customerId,
          return_url: `${appUrl}/settings?billing=portal-return`,
        });
        return NextResponse.json({
          url: portal.url,
          alreadySubscribed: true,
        });
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/settings?billing=success`,
      cancel_url: `${appUrl}/settings?billing=cancelled`,
      metadata: { userId: user.id, plan },
      subscription_data: {
        metadata: { userId: user.id, plan },
      },
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url, selectedPlan: plan });
  } catch (error) {
    console.error("Failed to create Stripe checkout session:", error);
    return NextResponse.json({ error: "Failed to create checkout session." }, { status: 500 });
  }
}
