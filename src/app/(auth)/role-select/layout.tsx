import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrCreateUser } from "@/lib/clerk-auth";

/** If user already has a role, redirect to dashboard or book. */
export default async function RoleSelectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await getOrCreateUser(userId);
  if (user?.role) {
    if (user.role === "CANDIDATE") redirect("/book");
    redirect("/");
  }

  return <>{children}</>;
}
