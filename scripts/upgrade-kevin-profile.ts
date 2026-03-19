import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: "kphan2729@gmail.com" },
    include: { profile: true },
  });

  if (!user) {
    console.error("User kphan2729@gmail.com not found.");
    process.exit(1);
  }

  // Wipe existing profile data
  if (user.profile) {
    await prisma.candidateProfile.delete({ where: { userId: user.id } });
    console.log("Deleted old profile.");
  }

  // Rebuild with a rich, impressive profile
  await prisma.candidateProfile.create({
    data: {
      userId: user.id,
      headline: "Licensed Practical Nurse | Acute Care & Patient Safety Specialist",
      summary:
        "Dedicated and compassionate Licensed Practical Nurse with 4+ years of progressive clinical experience in acute care, oncology, and long-term care settings. Recognized for exceptional bedside manner, clinical accuracy, and the ability to remain composed in high-pressure environments. Proven track record of improving patient satisfaction scores and reducing medication error rates through meticulous documentation and team collaboration. Passionate about lifelong learning and committed to pursuing RN licensure to expand scope of practice.",
      phone: "(813) 555-1234",
      city: "Tampa",
      state: "FL",
      country: "United States",

      experiences: {
        create: [
          {
            title: "Licensed Practical Nurse (LPN)",
            company: "Moffitt Cancer Center",
            description:
              "Deliver direct patient care to oncology patients across a 32-bed inpatient unit, administering chemotherapy protocols, managing central line care, and monitoring for adverse reactions. Collaborate with RNs, oncologists, and pharmacy to execute individualized care plans. Recognized as 'Employee of the Quarter' (Q3 2024) for consistent high patient satisfaction scores (98th percentile HCAHPS). Mentor newly hired CNAs and orient LPN students during clinical rotations.",
            startDate: new Date(2024, 2, 1),
            endDate: null,
            current: true,
          },
          {
            title: "Certified Nursing Assistant (CNA)",
            company: "Tampa General Hospital",
            description:
              "Supported a team of RNs on a busy 40-bed medical-surgical floor, performing vital signs monitoring, personal care, mobility assistance, and specimen collection. Maintained accurate intake/output records and communicated real-time changes in patient condition to the charge nurse. Achieved zero medication-related incident reports across 22 months of service. Assisted in training 3 new CNAs on departmental protocols and TGH documentation standards.",
            startDate: new Date(2022, 4, 1),
            endDate: new Date(2024, 2, 1),
            current: false,
          },
          {
            title: "Patient Care Technician",
            company: "BayCare Health System",
            description:
              "Provided compassionate bedside care in a 24-bed rehabilitation unit, supporting patients recovering from strokes, joint replacements, and traumatic injuries. Assisted physical and occupational therapists with patient transfers and therapeutic exercises. Maintained a safe and sanitary environment consistent with Joint Commission standards. Awarded 'CARE Values Champion' recognition by unit director in 2022.",
            startDate: new Date(2020, 8, 1),
            endDate: new Date(2022, 3, 1),
            current: false,
          },
        ],
      },

      educations: {
        create: [
          {
            school: "Hillsborough Community College",
            degree: "Associate of Science in Nursing",
            field: "Practical Nursing",
            startDate: new Date(2020, 7, 1),
            endDate: new Date(2022, 4, 1),
          },
          {
            school: "University of South Florida",
            degree: "Bachelor of Science in Nursing (in progress)",
            field: "Nursing — RN-BSN Bridge Program",
            startDate: new Date(2024, 8, 1),
            endDate: null,
          },
        ],
      },

      skills: {
        create: [
          { name: "IV Therapy & Phlebotomy" },
          { name: "Medication Administration" },
          { name: "Wound Care & Dressing Changes" },
          { name: "Oncology Patient Care" },
          { name: "Vital Signs Monitoring" },
          { name: "Patient & Family Education" },
          { name: "EHR Documentation (Epic)" },
          { name: "Central Line Care" },
          { name: "Pain Assessment & Management" },
          { name: "Infection Control & Isolation Precautions" },
          { name: "Care Plan Implementation" },
          { name: "HIPAA Compliance" },
        ],
      },

      certifications: {
        create: [
          {
            name: "Licensed Practical Nurse (LPN)",
            issuer: "Florida Board of Nursing",
            issueDate: new Date(2022, 5, 1),
            expiryDate: new Date(2026, 5, 30),
          },
          {
            name: "Basic Life Support (BLS)",
            issuer: "American Heart Association",
            issueDate: new Date(2023, 6, 1),
            expiryDate: new Date(2025, 6, 1),
          },
          {
            name: "Oncology Nursing Society — Chemotherapy & Biotherapy Provider",
            issuer: "Oncology Nursing Society (ONS)",
            issueDate: new Date(2024, 4, 1),
            expiryDate: new Date(2026, 4, 1),
          },
          {
            name: "Certified Nursing Assistant (CNA)",
            issuer: "Florida Department of Health",
            issueDate: new Date(2020, 7, 1),
            expiryDate: new Date(2028, 7, 1),
          },
        ],
      },
    },
  });

  console.log("✓ Kevin Phan profile upgraded successfully.");
  console.log("  • 3 work experiences (Moffitt, Tampa General, BayCare)");
  console.log("  • 2 education entries (HCC + USF RN-BSN bridge)");
  console.log("  • 12 skills");
  console.log("  • 4 certifications (with proper expiry dates)");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
