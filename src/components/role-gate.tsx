import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrCreateUser } from "@/lib/clerk-auth";

interface RoleGateProps {
  children: React.ReactNode;
  requireRole?: "EMPLOYER" | "CANDIDATE" | null;
}

/**
 * Server component that enforces role-based access.
 * - No role → /role-select
 * - CANDIDATE hitting employer dashboard → /profile
 * - EMPLOYER hitting candidate-only route → /
 */
export async function RoleGate({ children, requireRole }: RoleGateProps) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await getOrCreateUser(userId);
  if (!user) redirect("/sign-in");

  // No role assigned yet — must complete role selection
  if (!user.role) {
    redirect("/role-select");
  }

  // Explicit requireRole check
  if (requireRole === "EMPLOYER" && user.role !== "EMPLOYER") {
    redirect("/profile");
  }
  if (requireRole === "CANDIDATE" && user.role !== "CANDIDATE") {
    redirect("/");
  }

  // Default (no requireRole): if candidate lands on employer dashboard, redirect away
  if (!requireRole && user.role === "CANDIDATE") {
    redirect("/profile");
  }

  return <>{children}</>;
}
