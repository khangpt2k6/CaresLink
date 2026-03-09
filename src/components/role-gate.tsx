import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrCreateUser } from "@/lib/clerk-auth";

interface RoleGateProps {
  children: React.ReactNode;
  requireRole?: "EMPLOYER" | "CANDIDATE" | null;
}

/** Server component: redirects to /role-select if user has no role, or to / if candidate tries employer routes. */
export async function RoleGate({ children, requireRole }: RoleGateProps) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await getOrCreateUser(userId);
  if (!user) redirect("/sign-in");

  if (!user.role) {
    redirect("/role-select");
  }

  if (requireRole === "EMPLOYER" && user.role !== "EMPLOYER") {
    redirect("/");
  }

  return <>{children}</>;
}
