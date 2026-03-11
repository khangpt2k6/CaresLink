import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const HEALTHCARE_JOBS = [
  {
    title: "Registered Nurse",
    department: "Clinical Care",
    location: "San Francisco, CA",
    type: "Full-time",
    description:
      "Provide direct patient care, administer medications, monitor vital signs, and collaborate with physicians and care teams. BSN preferred, active RN license required.",
  },
  {
    title: "Medical Assistant",
    department: "Clinical Support",
    location: "Remote",
    type: "Full-time",
    description:
      "Support clinical operations: rooming patients, taking vitals, preparing exam rooms, and assisting with procedures. CMA or RMA certification preferred.",
  },
  {
    title: "Patient Care Coordinator",
    department: "Care Management",
    location: "Hybrid",
    type: "Full-time",
    description:
      "Coordinate patient care plans, schedule appointments, liaise between patients and providers, and ensure smooth care transitions.",
  },
  {
    title: "Clinical Coordinator",
    department: "Operations",
    location: "Chicago, IL",
    type: "Full-time",
    description:
      "Oversee clinical workflows, support care team coordination, and ensure compliance with healthcare standards and protocols.",
  },
  {
    title: "Care Coordinator",
    department: "Care Management",
    location: "Remote",
    type: "Part-time",
    description:
      "Connect patients with appropriate services, conduct intake assessments, and follow up on care plans. Ideal for RNs or social workers.",
  },
  {
    title: "Healthcare Administrator",
    department: "Administration",
    location: "New York, NY",
    type: "Full-time",
    description:
      "Manage day-to-day operations of healthcare facilities, oversee staff, budgets, and compliance. MPH or MHA preferred.",
  },
  {
    title: "Medical Billing Specialist",
    department: "Revenue Cycle",
    location: "Remote",
    type: "Full-time",
    description:
      "Process claims, verify insurance, handle billing inquiries, and ensure accurate medical coding. Experience with EHR systems required.",
  },
  {
    title: "Pharmacy Technician",
    department: "Pharmacy",
    location: "Los Angeles, CA",
    type: "Full-time",
    description:
      "Assist pharmacists with dispensing medications, inventory management, and patient interactions. PTCB certification preferred.",
  },
  {
    title: "Medical Records Technician",
    department: "Health Information",
    location: "Remote",
    type: "Contract",
    description:
      "Maintain and organize patient records, ensure HIPAA compliance, and support health information management. RHIT or equivalent preferred.",
  },
];

async function main() {
  let created = 0;
  let skipped = 0;

  for (const job of HEALTHCARE_JOBS) {
    const existing = await prisma.job.findFirst({
      where: { title: job.title },
    });
    if (existing) {
      skipped++;
      console.log(`  - ${job.title} (already exists)`);
      continue;
    }

    await prisma.job.create({ data: job });
    created++;
    console.log(`  + ${job.title}`);
  }

  console.log(`\nDone: ${created} jobs created, ${skipped} skipped.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
