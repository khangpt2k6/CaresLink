import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/db";
import { getStripeClient, getStripeWebhookSecret } from "@/lib/stripe";

export const runtime = "nodejs";

function asDate(unixSeconds: number | null | undefined): Date | null {
  if (!unixSeconds) return null;
  return new Date(unixSeconds * 1000);
}

async function resolveUserIdFromCustomer(params: {
  stripe: Stripe;
  customerId: string;
  metadataUserId?: string;
}): Promise<string | null> {
  if (params.metadataUserId) return params.metadataUserId;

  const existing = await prisma.userSubscription.findFirst({
    where: { stripeCustomerId: params.customerId },
    select: { userId: true },
  });
  if (existing?.userId) return existing.userId;

  const customer = await params.stripe.customers.retrieve(params.customerId);
  if (!customer || customer.deleted || !customer.email) return null;

  const user = await prisma.user.findUnique({
    where: { email: customer.email },
    select: { id: true },
  });
  return user?.id ?? null;
}

async function upsertFromSubscription(subscription: Stripe.Subscription) {
  const stripe = getStripeClient();
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;

  if (!customerId) return;

  const metadataUserId = subscription.metadata?.userId || undefined;
  const userId = await resolveUserIdFromCustomer({ stripe, customerId, metadataUserId });
  if (!userId) return;

  const item = subscription.items.data[0];
  const itemPeriodEnds = subscription.items.data
    .map((entry) => entry.current_period_end)
    .filter((v): v is number => typeof v === "number");
  const maxItemPeriodEnd = itemPeriodEnds.length > 0 ? Math.max(...itemPeriodEnds) : null;
  const currentPeriodEnd = asDate(maxItemPeriodEnd);

  const isPremiumStatus = subscription.status === "active" || subscription.status === "trialing";
  const premiumUntil = isPremiumStatus ? currentPeriodEnd : null;

  await prisma.userSubscription.upsert({
    where: { userId },
    update: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      stripePriceId: item?.price?.id || null,
      status: subscription.status,
      currentPeriodEnd,
      premiumUntil,
    },
    create: {
      userId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      stripePriceId: item?.price?.id || null,
      status: subscription.status,
      currentPeriodEnd,
      premiumUntil,
    },
  });
}

export async function POST(request: NextRequest) {
  const stripe = getStripeClient();
  const webhookSecret = getStripeWebhookSecret();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    const payload = await request.text();
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    console.error("Stripe webhook signature verification failed:", error);
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;

        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await upsertFromSubscription(subscription);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await upsertFromSubscription(subscription);
        break;
      }
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook handling failed:", error);
    return NextResponse.json({ error: "Webhook handling failed." }, { status: 500 });
  }
}
