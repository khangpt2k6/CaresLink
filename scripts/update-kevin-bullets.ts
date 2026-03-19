import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const profile = await prisma.candidateProfile.findFirst({
    where: { user: { email: "kphan2729@gmail.com" } },
    include: { experiences: true },
  });
  if (!profile) { console.error("Not found"); process.exit(1); }

  // Shorten summary to 2 punchy sentences
  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: {
      summary: "LPN with 4+ years in acute care and oncology at Moffitt Cancer Center and Tampa General Hospital. Recognized for clinical accuracy, high patient satisfaction scores, and a commitment to advancing toward RN licensure.",
    },
  });

  // Rewrite experience descriptions as newline-separated bullet points
  const bullets: Record<string, string> = {
    "Licensed Practical Nurse (LPN)": [
      "Deliver direct patient care to oncology patients across a 32-bed inpatient unit",
      "Administer chemotherapy protocols, manage central line care, and monitor for adverse reactions",
      "Collaborate with RNs, oncologists, and pharmacy to execute individualized care plans",
      "Recognized as Employee of the Quarter (Q3 2024) — 98th percentile HCAHPS scores",
      "Mentor newly hired CNAs and orient LPN students during clinical rotations",
    ].join("\n"),

    "Certified Nursing Assistant (CNA)": [
      "Supported RNs on a busy 40-bed medical-surgical floor at Tampa General Hospital",
      "Performed vital signs monitoring, personal care, mobility assistance, and specimen collection",
      "Maintained accurate intake/output records and communicated changes to the charge nurse",
      "Achieved zero medication-related incident reports across 22 months of service",
      "Assisted in training 3 new CNAs on departmental protocols and documentation standards",
    ].join("\n"),

    "Patient Care Technician": [
      "Provided bedside care in a 24-bed rehabilitation unit for stroke, joint replacement, and trauma patients",
      "Assisted physical and occupational therapists with patient transfers and therapeutic exercises",
      "Maintained a safe environment consistent with Joint Commission standards",
      "Awarded CARE Values Champion recognition by unit director in 2022",
    ].join("\n"),
  };

  for (const exp of profile.experiences) {
    const desc = bullets[exp.title];
    if (desc) {
      await prisma.experience.update({ where: { id: exp.id }, data: { description: desc } });
      console.log(`Updated: ${exp.title}`);
    }
  }

  console.log("Done.");
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
