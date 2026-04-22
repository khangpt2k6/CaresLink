/**
 * Seed demo credential_checks rows for the Credential Verification screen.
 * Matches the screenshot the user provided:
 *  - Maria Johnson (RN / CNA) multiple rows with different outcomes
 *  - James Hall (CNA) one Review-Required row
 *
 * Run:
 *   cd prototype_careslink
 *   SEED_EMPLOYER_EMAIL=kphan2729@gmail.com npx tsx scripts/seed-credential-history.ts
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";

const TARGET_EMAIL = process.env.SEED_EMPLOYER_EMAIL || "kphan2729@gmail.com";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);
const prisma = new PrismaClient();

async function findEmployerId(email: string): Promise<string> {
  let page = 1;
  for (let i = 0; i < 10; i++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit.id;
    if (data.users.length < 1000) break;
    page++;
  }
  throw new Error(`${email} not found in auth.users`);
}

type Recommendation = "employable" | "review_required" | "not_employable";

interface DemoRow {
  daysAgo: number;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  email: string;
  phone?: string;
  licenseNumber?: string;
  roleType: "RN" | "LPN" | "CNA";
  recommendation: Recommendation;
  reason: string;
  sourceStatus: "found" | "not_found";
  licenseStatus: string;
}

const DEMO: DemoRow[] = [
  {
    daysAgo: 0,
    firstName: "Maria",
    middleName: "A",
    lastName: "Johnson",
    email: "maria.johnson@email.com",
    phone: "813-555-2847",
    licenseNumber: "RN9458458",
    roleType: "CNA",
    recommendation: "employable",
    reason:
      "Active FL DOH CNA record under MARIA A JOHNSON; status Clear/Active with no disciplinary flags.",
    sourceStatus: "found",
    licenseStatus: "Clear/Active",
  },
  {
    daysAgo: 0,
    firstName: "James",
    lastName: "Hall",
    email: "james.hall@example.com",
    roleType: "CNA",
    recommendation: "review_required",
    reason:
      "Multiple Florida CNA records match name with no supplied license number — confirm date of birth or license # before hiring.",
    sourceStatus: "found",
    licenseStatus: "Clear/Active",
  },
  {
    daysAgo: 0,
    firstName: "Maria",
    lastName: "Johnson",
    email: "maria.johnson@email.com",
    phone: "813-555-2847",
    licenseNumber: "RN9458458",
    roleType: "RN",
    recommendation: "review_required",
    reason:
      "License number format is unusual for Florida RN; manual verification on MQA site is recommended.",
    sourceStatus: "found",
    licenseStatus: "Delinquent",
  },
  {
    daysAgo: 1,
    firstName: "Maria",
    lastName: "Johnson",
    email: "maria.johnson@email.com",
    licenseNumber: "RN9458458",
    roleType: "RN",
    recommendation: "employable",
    reason:
      "License active, valid through 2027-04-30. No disciplinary actions on file.",
    sourceStatus: "found",
    licenseStatus: "Clear/Active",
  },
  {
    daysAgo: 13,
    firstName: "Maria",
    lastName: "Johnson",
    email: "maria.johnson@email.com",
    licenseNumber: "RN9458458",
    roleType: "RN",
    recommendation: "review_required",
    reason:
      "Minor address mismatch between submitted and DOH record; not disqualifying but flag for HR follow-up.",
    sourceStatus: "found",
    licenseStatus: "Clear/Active",
  },
  {
    daysAgo: 13,
    firstName: "Maria",
    lastName: "Johnson",
    email: "maria.johnson@email.com",
    licenseNumber: "RN9458458",
    roleType: "RN",
    recommendation: "review_required",
    reason:
      "Duplicate of an earlier check; retained for audit. Prior recommendation stands.",
    sourceStatus: "found",
    licenseStatus: "Clear/Active",
  },
  {
    daysAgo: 21,
    firstName: "Maria",
    lastName: "Johnson",
    email: "maria.johnson@email.com",
    licenseNumber: "RN9458458",
    roleType: "RN",
    recommendation: "employable",
    reason:
      "RN license active in Florida. BLS/ACLS current per candidate profile. Cleared for employment.",
    sourceStatus: "found",
    licenseStatus: "Clear/Active",
  },
];

function buildSourceResults(row: DemoRow) {
  const searchedName = `${row.firstName} ${row.lastName}`.toUpperCase();
  return {
    status: row.sourceStatus,
    searchedName,
    licenseType:
      row.roleType === "RN"
        ? "Registered Nurse"
        : row.roleType === "LPN"
          ? "Licensed Practical Nurse"
          : "Certified Nursing Assistant",
    matches:
      row.sourceStatus === "found"
        ? [
            {
              name: `${row.firstName}${row.middleName ? ` ${row.middleName}` : ""} ${row.lastName}`.toUpperCase(),
              licenseNumber: row.licenseNumber ?? "",
              licenseType:
                row.roleType === "RN"
                  ? "Registered Nurse"
                  : row.roleType === "LPN"
                    ? "Licensed Practical Nurse"
                    : "Certified Nursing Assistant",
              status: row.licenseStatus,
              expirationDate: "04/30/2027",
              county: "HILLSBOROUGH",
              address: "TAMPA, FL",
            },
          ]
        : [],
    manualUrl:
      "https://mqa-internet.doh.state.fl.us/MQASearchServices/HealthCareProviders",
    checkedAt: new Date().toISOString(),
  };
}

async function main() {
  const employerId = await findEmployerId(TARGET_EMAIL);
  console.log(`✓ Employer: ${TARGET_EMAIL} (${employerId})`);

  // Wipe any existing demo rows for this employer that match our demo candidates
  // so the screen always shows exactly our seeded set.
  const { count } = await prisma.credential_checks.deleteMany({
    where: {
      created_by_user_id: employerId,
      candidate_email: { in: ["maria.johnson@email.com", "james.hall@example.com"] },
    },
  });
  if (count > 0) console.log(`  Removed ${count} old demo rows`);

  const now = Date.now();
  for (const row of DEMO) {
    const when = new Date(now - row.daysAgo * 24 * 3600 * 1000);
    await prisma.credential_checks.create({
      data: {
        created_at: when,
        updated_at: when,
        created_by_user_id: employerId,
        candidate_first_name: row.firstName,
        candidate_middle_name: row.middleName ?? null,
        candidate_last_name: row.lastName,
        candidate_email: row.email,
        candidate_phone: row.phone ?? null,
        license_number: row.licenseNumber ?? null,
        role_type: row.roleType,
        state: "FL",
        status: "completed",
        source_results: buildSourceResults(row) as object,
        ai_recommendation: row.recommendation,
        ai_reason: row.reason,
      },
    });
    console.log(
      `  + ${row.daysAgo}d ago · ${row.firstName} ${row.lastName} · ${row.roleType} · ${row.recommendation}`
    );
  }

  console.log(`\n✓ Seeded ${DEMO.length} credential_checks rows`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
