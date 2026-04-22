/**
 * Seed demo data for AI Job Matching testing.
 *
 * Inserts into Flutter PROD Supabase:
 *  - Ensures the target employer user has user_type=employer + a business_profile
 *  - Creates 2 demo jobs owned by them
 *  - Creates 5 demo candidates (auth.users + profile, user_type=professional)
 *
 * All demo candidates use emails matching `demo.*@careslink-mock.test`
 * for easy cleanup via scripts/cleanup-demo-matching.ts.
 *
 * Run:
 *   cd prototype_careslink
 *   npx tsx scripts/seed-demo-matching.ts
 *
 * Override employer email:
 *   SEED_EMPLOYER_EMAIL=someone@example.com npx tsx scripts/seed-demo-matching.ts
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";

const TARGET_EMAIL = process.env.SEED_EMPLOYER_EMAIL || "kphan2729@gmail.com";
const MOCK_DOMAIN = "careslink-mock.test";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const prisma = new PrismaClient();

async function findAuthUserByEmail(email: string) {
  let page = 1;
  // Supabase admin API is paginated; scan a few pages.
  for (let i = 0; i < 10; i++) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw error;
    const hit = data.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );
    if (hit) return hit;
    if (data.users.length < 1000) return null;
    page++;
  }
  return null;
}

async function ensureMockAuthUser(email: string) {
  const existing = await findAuthUserByEmail(email);
  if (existing) return existing;
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    password: `Mock!${Math.random().toString(36).slice(2)}`,
    user_metadata: { demo: true, source: "seed-demo-matching" },
  });
  if (error) throw error;
  return data.user!;
}

const DEMO_JOBS = [
  {
    job_title: "Registered Nurse (RN) – ICU",
    job_description:
      "Experienced ICU RN needed for a busy 24-bed unit. BLS/ACLS required. Ventilator management and critical-care experience a must.",
    role: "Registered Nurse",
    city: "Miami",
    state: "FL",
    country: "USA",
    nursing_skills_required: [
      "IV therapy",
      "Ventilator management",
      "Critical care",
      "ACLS",
    ],
    care_specialty: ["ICU", "Critical care"],
    shift_type: ["Night"],
    job_type: "Full-time",
    workplace_type: "On-site",
    certifications_required: "BLS, ACLS, RN license",
    no_of_open_positions: 2,
  },
  {
    job_title: "Certified Nursing Assistant (CNA) – Long-term Care",
    job_description:
      "CNA for skilled nursing facility. Day shift. Focus on activities of daily living and patient vitals monitoring.",
    role: "CNA",
    city: "Tampa",
    state: "FL",
    country: "USA",
    nursing_skills_required: ["Patient care", "Vital signs", "ADLs"],
    care_specialty: ["Long-term care"],
    shift_type: ["Day"],
    job_type: "Full-time",
    workplace_type: "On-site",
    certifications_required: "CNA license",
    no_of_open_positions: 3,
  },
];

const DEMO_CANDIDATES = [
  {
    first_name: "Maria",
    last_name: "Lopez",
    role: "Registered Nurse",
    care_specialty: ["ICU", "Critical care"],
    preferred_roles: ["Registered Nurse"],
    city: "Miami",
    about:
      "Charge RN, 7 years ICU. ACLS/BLS current. Comfortable with vent management and drips.",
  },
  {
    first_name: "James",
    last_name: "Chen",
    role: "Registered Nurse",
    care_specialty: ["ER", "Trauma"],
    preferred_roles: ["Registered Nurse"],
    city: "Orlando",
    about: "Level-1 trauma ER RN. Triage, stroke alerts, STEMI activations.",
  },
  {
    first_name: "Patricia",
    last_name: "Williams",
    role: "CNA",
    care_specialty: ["Long-term care"],
    preferred_roles: ["CNA"],
    city: "Tampa",
    about: "CNA 4 years SNF. Strong with ADLs and dementia care.",
  },
  {
    first_name: "Kevin",
    last_name: "Nguyen",
    role: "LPN",
    care_specialty: ["Med-Surg"],
    preferred_roles: ["LPN"],
    city: "Jacksonville",
    about:
      "LPN Med-Surg floor. Medication administration, IV push, wound care.",
  },
  {
    first_name: "Sarah",
    last_name: "Johnson",
    role: "Registered Nurse",
    care_specialty: ["ICU", "Cardiac"],
    preferred_roles: ["Registered Nurse"],
    city: "Miami",
    about:
      "CVICU RN 9 years. CRRT, balloon pump, post-op heart surgery recovery.",
  },
];

async function main() {
  console.log(`\nTarget employer email: ${TARGET_EMAIL}`);
  console.log(`Supabase URL: ${process.env.SUPABASE_URL}\n`);

  // 1. Employer auth user
  const employer = await findAuthUserByEmail(TARGET_EMAIL);
  if (!employer) {
    throw new Error(
      `No auth.users row for ${TARGET_EMAIL}. Sign up once in Flutter first, then rerun.`
    );
  }
  console.log(`✓ Found employer auth user: ${employer.id}`);

  // 2. profile row → user_type employer
  const existingProfile = await prisma.profile.findUnique({
    where: { id: employer.id },
  });
  if (existingProfile) {
    if (existingProfile.user_type !== "employer") {
      await prisma.profile.update({
        where: { id: employer.id },
        data: { user_type: "employer" },
      });
    }
  } else {
    await prisma.profile.create({
      data: {
        id: employer.id,
        email: TARGET_EMAIL,
        user_type: "employer",
      },
    });
  }
  console.log(`✓ profile.user_type = employer`);

  // 3. business_profile (required FK for jobs)
  let bp = await prisma.businessProfile.findFirst({
    where: { user_id: employer.id },
  });
  if (!bp) {
    bp = await prisma.businessProfile.create({
      data: {
        user_id: employer.id,
        business_name: "Demo Healthcare Group",
        about: "Auto-created by seed-demo-matching.ts for AI matching testing.",
        country: "USA",
        state: "FL",
        city: "Miami",
        contact_email: TARGET_EMAIL,
        business_type: ["Hospital"],
      },
    });
    console.log(`✓ Created business_profile ${bp.business_id}`);
  } else {
    console.log(`✓ Reusing business_profile ${bp.business_id}`);
  }

  // 4. Jobs (skip if employer already has any)
  const existingJobs = await prisma.jobs.findMany({
    where: { created_by_user_id: employer.id },
    select: { job_id: true, job_title: true },
  });
  if (existingJobs.length >= DEMO_JOBS.length) {
    console.log(
      `✓ Employer already has ${existingJobs.length} jobs, skipping job insert`
    );
  } else {
    for (const j of DEMO_JOBS) {
      const created = await prisma.jobs.create({
        data: {
          ...j,
          created_by_user_id: employer.id,
          created_by_bussiness_id: bp.business_id,
          updated_at: new Date(),
          is_visa_sponsored: false,
          business_unit: [],
        },
      });
      console.log(`  + Job: ${created.job_title} (${created.job_id})`);
    }
  }

  // 5. Candidates
  for (let i = 0; i < DEMO_CANDIDATES.length; i++) {
    const c = DEMO_CANDIDATES[i];
    const email = `demo.${c.first_name.toLowerCase()}.${c.last_name.toLowerCase()}@${MOCK_DOMAIN}`;
    const authUser = await ensureMockAuthUser(email);
    const existing = await prisma.profile.findUnique({
      where: { id: authUser.id },
    });
    const data = {
      first_name: c.first_name,
      last_name: c.last_name,
      user_type: "professional" as const,
      role: c.role,
      care_specialty: c.care_specialty,
      preferred_roles: c.preferred_roles,
      about: c.about,
      is_open_to_work: true,
    };
    if (existing) {
      await prisma.profile.update({ where: { id: authUser.id }, data });
    } else {
      await prisma.profile.create({
        data: {
          ...data,
          id: authUser.id,
          email,
          preferred_job_type: ["Full-time"],
          city: c.city,
          state: "FL",
          country: "USA",
        },
      });
    }
    console.log(`  + Candidate: ${c.first_name} ${c.last_name} (${email})`);
  }

  console.log(
    `\n✓ Done. In the Flutter app:\n` +
      `   1. Reload Employer Profile Page\n` +
      `   2. Tap "AI Job Matching"\n` +
      `   3. Select a demo job and tap Recompute\n`
  );
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
