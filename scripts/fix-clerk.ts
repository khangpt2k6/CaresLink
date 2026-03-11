import { PrismaClient } from "@prisma/client";
import { createClerkClient } from "@clerk/backend";

const prisma = new PrismaClient();
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true, clerkId: true },
  });

  for (const user of users) {
    if (!user.clerkId) {
      console.log(`Skipping ${user.email} — no clerkId`);
      continue;
    }
    try {
      await clerk.users.updateUserMetadata(user.clerkId, {
        publicMetadata: { role: user.role || "EMPLOYER" },
      });
      console.log(`Synced Clerk metadata for ${user.email}: role=${user.role}`);
    } catch (e: any) {
      console.error(`Failed for ${user.email}:`, e.message);
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
