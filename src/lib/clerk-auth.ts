import { auth } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/** Get or create our User from Clerk. Returns null if Clerk user not found. */
export async function getOrCreateUser(clerkUserId: string) {
  const existing = await prisma.user.findUnique({
    where: { clerkId: clerkUserId },
  });
  if (existing) return existing;

  const client = await clerkClient();
  const clerkUser = await client.users.getUser(clerkUserId);
  const email = clerkUser.emailAddresses[0]?.emailAddress;
  if (!email) return null;

  // Check by email in case of migration from NextAuth
  const byEmail = await prisma.user.findUnique({
    where: { email },
  });
  if (byEmail) {
    await prisma.user.update({
      where: { id: byEmail.id },
      data: { clerkId: clerkUserId, image: clerkUser.imageUrl },
    });
    return prisma.user.findUniqueOrThrow({ where: { id: byEmail.id } });
  }

  return prisma.user.create({
    data: {
      clerkId: clerkUserId,
      email,
      name: clerkUser.firstName && clerkUser.lastName
        ? `${clerkUser.firstName} ${clerkUser.lastName}`
        : clerkUser.firstName ?? clerkUser.username ?? null,
      image: clerkUser.imageUrl,
    },
  });
}

/** Require auth and return our User. Returns 401 if not signed in. */
export async function requireUser(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const user = await getOrCreateUser(userId);
  if (!user) {
    return { error: NextResponse.json({ error: "User sync failed" }, { status: 500 }) };
  }
  return { user };
}

/** Require employer role. Returns 401 if not signed in, 403 if not employer. */
export async function requireEmployer(req: NextRequest) {
  const result = await requireUser(req);
  if (result.error) return result;
  const { user } = result;
  if (user.role !== "EMPLOYER") {
    return {
      error: NextResponse.json(
        { error: "Only recruiters can perform this action." },
        { status: 403 }
      ),
    };
  }
  return { user };
}

/** Require candidate role. Returns 401 if not signed in, 403 if not candidate. */
export async function requireCandidate(req: NextRequest) {
  const result = await requireUser(req);
  if (result.error) return result;
  const { user } = result;
  if (user.role !== "CANDIDATE") {
    return {
      error: NextResponse.json(
        { error: "Only candidates can perform this action." },
        { status: 403 }
      ),
    };
  }
  return { user };
}
