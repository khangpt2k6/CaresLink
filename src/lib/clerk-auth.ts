// File name kept for diff readability; this is the Supabase-JWT auth helper.
// Role gates are based on profile.user_type on Flutter's production DB.
//   POC EMPLOYER  -> user_type "employer"
//   POC CANDIDATE -> user_type "professional"

import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { profile as Profile, UserTypes } from "@prisma/client";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

export type AppUser = Profile;

function unauthorized(message = "Unauthorized") {
  return NextResponse.json({ error: message }, { status: 401 });
}

function forbidden(message: string) {
  return NextResponse.json({ error: message }, { status: 403 });
}

/**
 * Load the profile row whose PK equals the Supabase auth.users.id.
 * If Supabase has an authenticated user but no profile row exists yet,
 * create a minimal one so downstream code can attach AI usage / embeddings.
 */
async function loadOrCreateProfile(supabaseUserId: string, email: string): Promise<Profile | null> {
  const existing = await prisma.profile.findUnique({ where: { id: supabaseUserId } });
  if (existing) return existing;

  try {
    return await prisma.profile.create({
      data: { id: supabaseUserId, email },
    });
  } catch {
    // Race or RLS rejection — fall back to a re-read.
    return prisma.profile.findUnique({ where: { id: supabaseUserId } });
  }
}

/** Require auth via Supabase JWT (Authorization: Bearer <access_token>). */
export async function requireUser(
  req: NextRequest
): Promise<{ user: AppUser; error?: undefined } | { user?: undefined; error: NextResponse }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return { error: unauthorized() };

  const token = authHeader.slice("Bearer ".length).trim();
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user || !data.user.email) return { error: unauthorized("Invalid token") };

  const user = await loadOrCreateProfile(data.user.id, data.user.email);
  if (!user) {
    return {
      error: NextResponse.json({ error: "User sync failed" }, { status: 500 }),
    };
  }
  return { user };
}

function hasUserType(user: AppUser, target: UserTypes): boolean {
  return user.user_type === target;
}

/** Require employer (recruiter / business). */
export async function requireEmployer(req: NextRequest) {
  const result = await requireUser(req);
  if (result.error) return result;
  if (!hasUserType(result.user, "employer")) {
    return { error: forbidden("Only recruiters can perform this action.") };
  }
  return { user: result.user };
}

/** Require candidate (healthcare professional). */
export async function requireCandidate(req: NextRequest) {
  const result = await requireUser(req);
  if (result.error) return result;
  if (!hasUserType(result.user, "professional")) {
    return { error: forbidden("Only candidates can perform this action.") };
  }
  return { user: result.user };
}
