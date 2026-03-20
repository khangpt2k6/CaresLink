import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = "maria.johnson@email.com";

  // ── 1. Pipeline Candidate (employer side) ──────────────────
  const existingCandidate = await prisma.candidate.findFirst({ where: { email } });
  if (existingCandidate) {
    console.log("Pipeline candidate already exists, skipping...");
  } else {
    await prisma.candidate.create({
      data: {
        name: "Maria Johnson",
        email,
        phone: "813-555-2847",
        position: "Registered Nurse",
        status: "applied",
      },
    });
    console.log("+ Created pipeline candidate: Maria Johnson");
  }

  // ── 2. User + CandidateProfile (candidate side) ───────────
  let user = await prisma.user.findUnique({ where: { email }, include: { profile: true } });

  if (user?.profile) {
    console.log("Candidate profile already exists, skipping...");
  } else {
    if (!user) {
      user = await prisma.user.create({
        data: {
          name: "Maria Johnson",
          email,
          role: "CANDIDATE",
        },
        include: { profile: true },
      });
      console.log("+ Created user: Maria Johnson");
    } else if (!user.role) {
      await prisma.user.update({ where: { id: user.id }, data: { role: "CANDIDATE" } });
    }

    await prisma.candidateProfile.create({
      data: {
        userId: user.id,
        headline: "Registered Nurse | Med-Surg & Telemetry Specialist",
        summary:
          "Compassionate and detail-oriented Registered Nurse with 5+ years of experience in acute care settings across Florida. " +
          "Proven ability to manage complex patient cases, collaborate with multidisciplinary teams, and deliver evidence-based care. " +
          "Currently seeking full-time opportunities in the Tampa Bay area.",
        phone: "813-555-2847",
        city: "Tampa",
        state: "FL",
        country: "United States",
        experiences: {
          create: [
            {
              title: "Registered Nurse - Med/Surg",
              company: "Tampa General Hospital",
              description:
                "Manage a patient load of 5-6 on a 36-bed medical-surgical unit. " +
                "Administer medications, monitor vital signs, coordinate with physicians and discharge planners. " +
                "Mentor new graduate nurses during orientation.",
              startDate: new Date("2022-06-01"),
              endDate: null,
              current: true,
            },
            {
              title: "Staff Nurse - Telemetry",
              company: "AdventHealth Orlando",
              description:
                "Provided telemetry monitoring and cardiac care for post-operative and chronic heart failure patients. " +
                "Maintained 98% medication administration accuracy. Served as charge nurse on rotating basis.",
              startDate: new Date("2020-01-01"),
              endDate: new Date("2022-05-01"),
              current: false,
            },
            {
              title: "Graduate Nurse Resident",
              company: "BayCare Health System",
              description:
                "Completed 12-month residency program in medical-surgical nursing. " +
                "Gained competency in wound care, IV therapy, and patient education.",
              startDate: new Date("2019-01-01"),
              endDate: new Date("2019-12-01"),
              current: false,
            },
          ],
        },
        educations: {
          create: [
            {
              school: "University of South Florida",
              degree: "Bachelor of Science in Nursing",
              field: "Nursing",
              startDate: new Date("2015-08-01"),
              endDate: new Date("2019-05-01"),
            },
          ],
        },
        skills: {
          create: [
            { name: "Patient Assessment" },
            { name: "IV Therapy" },
            { name: "Medication Administration" },
            { name: "Wound Care" },
            { name: "Telemetry Monitoring" },
            { name: "Electronic Health Records (EHR)" },
            { name: "Patient Education" },
            { name: "ACLS" },
            { name: "BLS" },
          ],
        },
        certifications: {
          create: [
            {
              name: "Registered Nurse (RN)",
              issuer: "Florida Board of Nursing",
              issueDate: new Date("2019-06-15"),
              expiryDate: new Date("2027-06-15"),
            },
            {
              name: "Basic Life Support (BLS)",
              issuer: "American Heart Association",
              issueDate: new Date("2024-03-01"),
              expiryDate: new Date("2026-03-01"),
            },
            {
              name: "Advanced Cardiovascular Life Support (ACLS)",
              issuer: "American Heart Association",
              issueDate: new Date("2024-03-01"),
              expiryDate: new Date("2026-03-01"),
            },
          ],
        },
        preferences: {
          create: {
            roles: ["RN", "Charge Nurse"],
            businessUnits: ["Hospital", "Acute Care"],
            jobTypes: ["Full-time"],
            shifts: ["Weekday", "Day"],
          },
        },
      },
    });
    console.log("+ Created full candidate profile for Maria Johnson");
  }

  console.log("\nDone! Maria Johnson is now available in both the pipeline and as a registered candidate.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
