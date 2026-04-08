import Stripe from "stripe";

let stripeClient: Stripe | null = null;
export type BillingPlan = "starter" | "pro";

export function getStripeClient(): Stripe {
  if (stripeClient) return stripeClient;

  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }

  stripeClient = new Stripe(apiKey);
  return stripeClient;
}

export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

function getStarterPriceId(): string {
  const starterId = process.env.STRIPE_STARTER_PRICE_ID || process.env.STRIPE_PREMIUM_PRICE_ID;
  if (!starterId) {
    throw new Error("STRIPE_STARTER_PRICE_ID (or STRIPE_PREMIUM_PRICE_ID) is not configured.");
  }
  return starterId;
}

export function getStripePriceId(plan: BillingPlan = "starter"): string {
  if (plan === "pro") {
    const proId = process.env.STRIPE_PRO_PRICE_ID;
    if (!proId) {
      throw new Error("STRIPE_PRO_PRICE_ID is not configured.");
    }
    return proId;
  }

  return getStarterPriceId();
}

export function getPlanFromPriceId(priceId: string | null | undefined): BillingPlan | "free" {
  if (!priceId) return "free";

  const starterId = process.env.STRIPE_STARTER_PRICE_ID || process.env.STRIPE_PREMIUM_PRICE_ID;
  const proId = process.env.STRIPE_PRO_PRICE_ID;

  if (proId && priceId === proId) return "pro";
  if (starterId && priceId === starterId) return "starter";

  // Backward-compatible fallback: unknown paid price defaults to starter-level limits.
  return "starter";
}

export function getStripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured.");
  }
  return secret;
}
