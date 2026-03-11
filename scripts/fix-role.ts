import { PrismaClient } from "@prisma/client";
import { createClerkClient } from "@clerk/backend";

const prisma = new PrismaClient();
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

async function main() {
  // Find users with CANDIDATE role or no role
  const users = await prisma.user.findMany({
    where: { role: { not: "EMPLOYER" } },
    select: { id: true, email: true, role: true, clerkId: true },
  });
  console.log("Users to update:", users.map(u => `${u.email} (${u.role})`));

  for (const user of users) {
    // Update DB
    await prisma.user.update({
      where: { id: user.id },
      data: { role: "EMPLOYER" },
    });

    // Update Clerk metadata
    if (user.clerkId) {
      try {
        await clerk.users.updateUserMetadata(user.clerkId, {
          publicMetadata: { role: "EMPLOYER" },
        });
        console.log(`Updated Clerk metadata for ${user.email}`);
      } catch (e: any) {
        console.error(`Failed to update Clerk for ${user.email}:`, e.message);
      }
    }
  }

  console.log(`Done. Updated ${users.length} user(s) to EMPLOYER.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
