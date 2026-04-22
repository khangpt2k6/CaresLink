/**
 * Remove all mock data created by seed-demo-matching.ts.
 * Deletes:
 *  - Demo candidate profiles + auth.users (email @careslink-mock.test)
 *  - All jobs whose title matches our DEMO_JOBS
 *  - Their job_match_scores + job_embeddings + profile_embeddings
 *  - Business profile named "Demo Healthcare Group"
 *
 * Does NOT delete or modify the target employer account.
 *
 * Run:
 *   cd prototype_careslink
 *   npx tsx scripts/cleanup-demo-matching.ts
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";

const MOCK_DOMAIN = "careslink-mock.test";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);
const prisma = new PrismaClient();

async function* allAuthUsers() {
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw error;
    for (const u of data.users) yield u;
    if (data.users.length < 1000) return;
    page++;
  }
}

async function main() {
  console.log(`\nCleaning demo data from ${process.env.SUPABASE_URL}\n`);

  // 1. Find mock auth users
  const mockUsers: string[] = [];
  for await (const u of allAuthUsers()) {
    if (u.email?.endsWith(`@${MOCK_DOMAIN}`)) mockUsers.push(u.id);
  }
  console.log(`Found ${mockUsers.length} mock auth users`);

  if (mockUsers.length) {
    // Delete embeddings first (FK)
    const delEmb = await prisma.profile_embeddings.deleteMany({
      where: { profile_id: { in: mockUsers } },
    });
    console.log(`  - profile_embeddings: ${delEmb.count}`);

    const delScores = await prisma.job_match_scores.deleteMany({
      where: { profile_id: { in: mockUsers } },
    });
    console.log(`  - job_match_scores (by candidate): ${delScores.count}`);

    const delProfiles = await prisma.profile.deleteMany({
      where: { id: { in: mockUsers } },
    });
    console.log(`  - profile: ${delProfiles.count}`);

    for (const uid of mockUsers) {
      await supabase.auth.admin.deleteUser(uid).catch((e) => {
        console.warn(`  (failed to delete auth user ${uid})`, e.message);
      });
    }
    console.log(`  - auth.users deleted: ${mockUsers.length}`);
  }

  // 2. Demo jobs (by title)
  const demoJobTitles = [
    "Registered Nurse (RN) – ICU",
    "Certified Nursing Assistant (CNA) – Long-term Care",
  ];
  const jobs = await prisma.jobs.findMany({
    where: { job_title: { in: demoJobTitles } },
    select: { job_id: true },
  });
  if (jobs.length) {
    const jobIds = jobs.map((j) => j.job_id);
    const delJobEmb = await prisma.job_embeddings.deleteMany({
      where: { job_id: { in: jobIds } },
    });
    console.log(`  - job_embeddings: ${delJobEmb.count}`);

    const delJobScores = await prisma.job_match_scores.deleteMany({
      where: { job_id: { in: jobIds } },
    });
    console.log(`  - job_match_scores (by job): ${delJobScores.count}`);

    const delJobs = await prisma.jobs.deleteMany({
      where: { job_id: { in: jobIds } },
    });
    console.log(`  - jobs: ${delJobs.count}`);
  }

  // 3. Demo business profile
  const delBP = await prisma.businessProfile.deleteMany({
    where: { business_name: "Demo Healthcare Group" },
  });
  console.log(`  - business_profile 'Demo Healthcare Group': ${delBP.count}`);

  console.log(`\n✓ Cleanup complete\n`);
}

main()
  .catch((e) => {
    console.error("Cleanup failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
