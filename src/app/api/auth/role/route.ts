import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";
import { getOrCreateUser } from "@/lib/clerk-auth";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { role } = await req.json();

  if (role !== "EMPLOYER" && role !== "CANDIDATE") {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const user = await getOrCreateUser(userId);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { role },
  });

  // Store role in Clerk publicMetadata for sidebar/nav
  const client = await clerkClient();
  await client.users.updateUserMetadata(userId, {
    publicMetadata: { role },
  });

  return NextResponse.json({ success: true });
}
