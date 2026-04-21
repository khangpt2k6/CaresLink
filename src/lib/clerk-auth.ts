import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

/**
 * Get or create our Prisma User from a Supabase auth user.
 * We overload the legacy `clerkId` column to store the Supabase auth user id
 * (a UUID) so the rest of the schema does not need to change yet.
 */
export async function getOrCreateUser(supabaseUserId: string, email: string) {
  const existing = await prisma.user.findUnique({
    where: { clerkId: supabaseUserId },
  });
  if (existing) return existing;

  const byEmail = await prisma.user.findUnique({ where: { email } });
  if (byEmail) {
    await prisma.user.update({
      where: { id: byEmail.id },
      data: { clerkId: supabaseUserId },
    });
    return prisma.user.findUniqueOrThrow({ where: { id: byEmail.id } });
  }

  return prisma.user.create({
    data: { clerkId: supabaseUserId, email },
  });
}

/** Require auth via Supabase JWT (Authorization: Bearer <access_token>). */
export async function requireUser(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  const token = authHeader.slice("Bearer ".length).trim();

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user || !data.user.email) {
    return {
      error: NextResponse.json({ error: "Invalid token" }, { status: 401 }),
    };
  }

  const user = await getOrCreateUser(data.user.id, data.user.email);
  if (!user) {
    return {
      error: NextResponse.json({ error: "User sync failed" }, { status: 500 }),
    };
  }
  return { user };
}

/** Require employer role. */
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

/** Require candidate role. */
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
