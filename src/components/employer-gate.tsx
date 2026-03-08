import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrCreateUser } from "@/lib/clerk-auth";

/** Server component: redirects to / if user is not an employer. */
export async function EmployerGate({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await getOrCreateUser(userId);
  if (!user || user.role !== "EMPLOYER") {
    redirect("/");
  }

  return <>{children}</>;
}
