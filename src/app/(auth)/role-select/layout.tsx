import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrCreateUser } from "@/lib/clerk-auth";

/** If user already has a role, redirect to dashboard. */
export default async function RoleSelectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await getOrCreateUser(userId);
  if (user?.role) {
    redirect("/");
  }

  return <>{children}</>;
}
