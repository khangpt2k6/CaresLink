import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    datasourceUrl: appendPoolParams(process.env.DATABASE_URL),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/** Append connection pool params if not already present */
function appendPoolParams(url: string | undefined): string | undefined {
  if (!url) return url;
  const u = new URL(url);
  if (!u.searchParams.has("connection_limit")) u.searchParams.set("connection_limit", "10");
  if (!u.searchParams.has("pool_timeout")) u.searchParams.set("pool_timeout", "30");
  if (!u.searchParams.has("connect_timeout")) u.searchParams.set("connect_timeout", "15");
  return u.toString();
}
