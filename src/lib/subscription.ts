import { prisma } from "@/lib/db";

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

export async function getUserSubscription(userId: string) {
  return prisma.userSubscription.findUnique({ where: { userId } });
}

export async function hasPremiumAccess(userId: string): Promise<boolean> {
  const sub = await getUserSubscription(userId);
  if (!sub) return false;

  const now = new Date();

  if (sub.premiumUntil && sub.premiumUntil > now) {
    return true;
  }

  if (sub.currentPeriodEnd && sub.currentPeriodEnd > now && ACTIVE_STATUSES.has(sub.status)) {
    return true;
  }

  return ACTIVE_STATUSES.has(sub.status);
}
