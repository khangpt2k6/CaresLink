import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ── Healthcare-realistic mock data pools ────────────────────

const cities = [
  { city: "Tampa", state: "FL" },
  { city: "Orlando", state: "FL" },
  { city: "Miami", state: "FL" },
  { city: "Jacksonville", state: "FL" },
  { city: "Atlanta", state: "GA" },
  { city: "Charlotte", state: "NC" },
  { city: "Houston", state: "TX" },
  { city: "Dallas", state: "TX" },
  { city: "Phoenix", state: "AZ" },
  { city: "Denver", state: "CO" },
];

const hospitals = [
  "Tampa General Hospital",
  "AdventHealth Orlando",
  "Moffitt Cancer Center",
  "Mayo Clinic",
  "Cleveland Clinic Florida",
  "Baptist Health",
  "HCA Healthcare",
  "Memorial Healthcare System",
  "Johns Hopkins All Children's",
  "Shriners Hospitals for Children",
  "UF Health Shands Hospital",
  "Jackson Memorial Hospital",
  "Sarasota Memorial Hospital",
  "Lee Health",
  "BayCare Health System",
];

const schools = [
  "University of South Florida",
  "University of Central Florida",
  "Florida State University",
  "University of Florida",
  "Nova Southeastern University",
  "Florida Atlantic University",
  "University of Miami",
  "Keiser University",
  "Rasmussen University",
  "Valencia College",
  "Hillsborough Community College",
  "Palm Beach State College",
];

// Position-specific data
const positionData: Record<
  string,
  {
    headlines: string[];
    summaries: string[];
    skills: string[];
    certifications: { name: string; issuer: string }[];
    degrees: { degree: string; field: string }[];
    titles: string[];
  }
> = {
  "Registered Nurse": {
    headlines: [
      "Registered Nurse | Critical Care & Emergency Medicine",
      "Experienced RN | Patient-Centered Care Advocate",
      "Registered Nurse | Med-Surg & Telemetry Specialist",
      "BSN, RN | Passionate About Community Health",
    ],
    summaries: [
      "Compassionate and detail-oriented Registered Nurse with extensive experience in acute care settings. Proven ability to manage complex patient cases, collaborate with multidisciplinary teams, and deliver evidence-based care. Dedicated to improving patient outcomes through continuous learning and professional development.",
      "Results-driven RN with a strong background in critical care and emergency nursing. Skilled in patient assessment, care planning, and clinical documentation. Committed to providing high-quality, patient-centered care in fast-paced healthcare environments.",
      "Dedicated nursing professional with experience across med-surg, telemetry, and step-down units. Known for exceptional clinical judgment, strong communication skills, and a genuine passion for patient advocacy.",
    ],
    skills: [
      "Patient Assessment",
      "IV Therapy",
      "Medication Administration",
      "Wound Care",
      "Electronic Health Records (EHR)",
      "Critical Care Nursing",
      "Patient Education",
      "Care Planning",
      "Telemetry Monitoring",
      "ACLS",
      "BLS",
      "Infection Control",
      "Pain Management",
      "Vital Signs Monitoring",
      "Clinical Documentation",
    ],
    certifications: [
      { name: "Registered Nurse (RN)", issuer: "Florida Board of Nursing" },
      { name: "Basic Life Support (BLS)", issuer: "American Heart Association" },
      {
        name: "Advanced Cardiovascular Life Support (ACLS)",
        issuer: "American Heart Association",
      },
      {
        name: "Certified Emergency Nurse (CEN)",
        issuer: "Board of Certification for Emergency Nursing",
      },
    ],
    degrees: [
      { degree: "Bachelor of Science in Nursing", field: "Nursing" },
      { degree: "Associate of Science in Nursing", field: "Nursing" },
    ],
    titles: [
      "Registered Nurse",
      "Staff Nurse",
      "Charge Nurse",
      "Travel Nurse",
      "Float Pool RN",
      "ICU Nurse",
    ],
  },
  "Medical Assistant": {
    headlines: [
      "Certified Medical Assistant | Primary Care",
      "Medical Assistant | Clinical & Administrative Support",
      "CMA | Dedicated to Patient Care Excellence",
    ],
    summaries: [
      "Versatile Certified Medical Assistant with hands-on experience in both clinical and administrative duties. Proficient in phlebotomy, EKG, patient intake, and electronic medical records. Thrives in fast-paced outpatient and primary care settings.",
      "Detail-oriented Medical Assistant with a strong foundation in clinical procedures and patient interaction. Experienced in scheduling, insurance verification, and assisting physicians during examinations. Known for excellent organizational skills and a warm patient demeanor.",
    ],
    skills: [
      "Phlebotomy",
      "EKG/ECG",
      "Vital Signs",
      "Patient Intake",
      "Medical Terminology",
      "Insurance Verification",
      "Scheduling",
      "Injections",
      "Specimen Collection",
      "HIPAA Compliance",
      "EMR/EHR Systems",
      "Autoclave Sterilization",
    ],
    certifications: [
      {
        name: "Certified Medical Assistant (CMA)",
        issuer: "American Association of Medical Assistants",
      },
      {
        name: "CPR/First Aid",
        issuer: "American Red Cross",
      },
      {
        name: "Certified Phlebotomy Technician",
        issuer: "National Healthcareer Association",
      },
    ],
    degrees: [
      { degree: "Associate of Science", field: "Medical Assisting" },
      { degree: "Diploma", field: "Medical Assisting" },
    ],
    titles: [
      "Medical Assistant",
      "Certified Medical Assistant",
      "Clinical Medical Assistant",
      "Back Office Medical Assistant",
    ],
  },
  "Patient Care Coordinator": {
    headlines: [
      "Patient Care Coordinator | Bridging Patients & Providers",
      "Care Coordinator | Population Health & Chronic Disease Management",
      "Patient Care Coordinator | Improving Health Outcomes",
    ],
    summaries: [
      "Organized and empathetic Patient Care Coordinator with experience managing patient referrals, appointment scheduling, and care transitions. Skilled in insurance navigation, patient advocacy, and multidisciplinary care coordination for complex patient populations.",
      "Experienced Care Coordinator focused on improving patient outcomes through proactive follow-up, resource connection, and streamlined care pathways. Strong background in chronic disease management and community health outreach.",
    ],
    skills: [
      "Care Coordination",
      "Patient Advocacy",
      "Referral Management",
      "Insurance Navigation",
      "Chronic Disease Management",
      "Care Transitions",
      "Appointment Scheduling",
      "Patient Education",
      "EHR Documentation",
      "Multidisciplinary Collaboration",
      "Case Management",
      "Community Resources",
    ],
    certifications: [
      {
        name: "Certified Patient Care Coordinator",
        issuer: "National Association of Healthcare Access Management",
      },
      { name: "BLS", issuer: "American Heart Association" },
    ],
    degrees: [
      { degree: "Bachelor of Science", field: "Health Administration" },
      { degree: "Associate of Science", field: "Health Information Technology" },
    ],
    titles: [
      "Patient Care Coordinator",
      "Care Coordinator",
      "Patient Navigator",
      "Care Transition Specialist",
    ],
  },
  "Clinical Coordinator": {
    headlines: [
      "Clinical Coordinator | Operations & Staff Management",
      "Clinical Coordinator | Quality Improvement Leader",
    ],
    summaries: [
      "Seasoned Clinical Coordinator with expertise in managing day-to-day clinical operations, staff scheduling, and quality assurance. Proven ability to optimize workflows, ensure regulatory compliance, and support clinical staff in delivering top-tier patient care.",
      "Dynamic Clinical Coordinator with a track record of improving clinical efficiency and patient satisfaction scores. Experienced in staff supervision, training program development, and Joint Commission readiness.",
    ],
    skills: [
      "Clinical Operations",
      "Staff Scheduling",
      "Quality Assurance",
      "Regulatory Compliance",
      "Workflow Optimization",
      "Staff Training",
      "Patient Satisfaction",
      "Budget Management",
      "Joint Commission Standards",
      "Performance Improvement",
      "Conflict Resolution",
      "Healthcare Policy",
    ],
    certifications: [
      {
        name: "Certified Healthcare Administrative Professional",
        issuer: "American Hospital Association",
      },
      { name: "BLS", issuer: "American Heart Association" },
      { name: "Lean Six Sigma Green Belt", issuer: "ASQ" },
    ],
    degrees: [
      { degree: "Bachelor of Science", field: "Healthcare Administration" },
      { degree: "Master of Health Administration", field: "Health Administration" },
    ],
    titles: [
      "Clinical Coordinator",
      "Clinical Operations Coordinator",
      "Clinic Supervisor",
      "Assistant Clinical Manager",
    ],
  },
  "Care Coordinator": {
    headlines: [
      "Care Coordinator | Patient-Centered Approach",
      "Care Coordinator | Chronic Care & Wellness Programs",
    ],
    summaries: [
      "Dedicated Care Coordinator skilled in developing individualized care plans, coordinating with providers, and connecting patients to community resources. Experienced in managing high-risk patient populations and reducing hospital readmissions.",
      "Compassionate Care Coordinator with expertise in wellness program management, patient follow-up, and healthcare resource coordination. Committed to holistic, patient-centered approaches that improve long-term health outcomes.",
    ],
    skills: [
      "Care Plan Development",
      "Patient Follow-Up",
      "Resource Coordination",
      "Risk Stratification",
      "Motivational Interviewing",
      "Telehealth Coordination",
      "Population Health",
      "Readmission Prevention",
      "Social Determinants of Health",
      "Data Entry & Reporting",
    ],
    certifications: [
      { name: "Certified Case Manager (CCM)", issuer: "Commission for Case Manager Certification" },
      { name: "CPR/BLS", issuer: "American Heart Association" },
    ],
    degrees: [
      { degree: "Bachelor of Science", field: "Social Work" },
      { degree: "Bachelor of Science", field: "Public Health" },
    ],
    titles: [
      "Care Coordinator",
      "Community Health Worker",
      "Case Manager",
      "Wellness Coordinator",
    ],
  },
  "Healthcare Administrator": {
    headlines: [
      "Healthcare Administrator | Strategic Operations Leader",
      "Healthcare Administrator | Finance, Compliance & Growth",
    ],
    summaries: [
      "Strategic Healthcare Administrator with 10+ years of experience overseeing hospital operations, budget management, and regulatory compliance. Adept at leading cross-functional teams, optimizing revenue cycles, and driving organizational growth in competitive healthcare markets.",
      "Results-oriented Healthcare Administrator with deep expertise in healthcare finance, policy development, and operational excellence. Proven success in managing multi-million dollar budgets and implementing process improvements that enhance both patient care and organizational performance.",
    ],
    skills: [
      "Healthcare Operations",
      "Budget Management",
      "Regulatory Compliance",
      "Revenue Cycle Management",
      "Strategic Planning",
      "HIPAA",
      "Staff Leadership",
      "Contract Negotiation",
      "Policy Development",
      "CMS Regulations",
      "Accreditation Management",
      "Vendor Management",
    ],
    certifications: [
      {
        name: "Fellow of the American College of Healthcare Executives (FACHE)",
        issuer: "ACHE",
      },
      {
        name: "Certified Healthcare Financial Professional (CHFP)",
        issuer: "HFMA",
      },
    ],
    degrees: [
      { degree: "Master of Health Administration", field: "Health Administration" },
      { degree: "Master of Business Administration", field: "Healthcare Management" },
    ],
    titles: [
      "Healthcare Administrator",
      "Practice Manager",
      "Director of Operations",
      "Assistant Administrator",
      "Department Manager",
    ],
  },
  "Medical Billing Specialist": {
    headlines: [
      "Medical Billing Specialist | Revenue Cycle Expert",
      "Certified Medical Biller & Coder | Claims & Reimbursement",
    ],
    summaries: [
      "Detail-oriented Medical Billing Specialist with extensive experience in claim submission, denial management, and accounts receivable. Proficient in ICD-10, CPT coding, and multiple billing platforms. Consistently achieves high clean claim rates and rapid reimbursement turnaround.",
      "Experienced Medical Billing Specialist with a strong understanding of payer requirements, insurance verification, and EOB reconciliation. Proven track record of reducing claim denials and improving revenue collection for multi-provider practices.",
    ],
    skills: [
      "ICD-10 Coding",
      "CPT Coding",
      "Claims Submission",
      "Denial Management",
      "Accounts Receivable",
      "Insurance Verification",
      "EOB Reconciliation",
      "Prior Authorization",
      "Medical Terminology",
      "Epic/Athenahealth",
      "Billing Compliance",
      "Patient Billing",
    ],
    certifications: [
      {
        name: "Certified Professional Biller (CPB)",
        issuer: "AAPC",
      },
      {
        name: "Certified Professional Coder (CPC)",
        issuer: "AAPC",
      },
    ],
    degrees: [
      { degree: "Associate of Science", field: "Health Information Management" },
      { degree: "Certificate", field: "Medical Billing & Coding" },
    ],
    titles: [
      "Medical Billing Specialist",
      "Medical Biller/Coder",
      "Billing Coordinator",
      "Revenue Cycle Specialist",
      "Claims Analyst",
    ],
  },
  "Pharmacy Technician": {
    headlines: [
      "Certified Pharmacy Technician | Retail & Hospital Pharmacy",
      "Pharmacy Technician | Medication Safety & Compounding",
    ],
    summaries: [
      "Reliable Certified Pharmacy Technician with experience in both retail and hospital pharmacy settings. Skilled in prescription processing, medication dispensing, inventory management, and sterile compounding. Committed to accuracy and patient safety in every interaction.",
      "Dedicated Pharmacy Technician with strong attention to detail and a thorough understanding of pharmaceutical procedures. Experienced in insurance claim processing, automated dispensing systems, and patient counseling support.",
    ],
    skills: [
      "Prescription Processing",
      "Medication Dispensing",
      "Inventory Management",
      "Sterile Compounding",
      "Insurance Claims",
      "Automated Dispensing Systems",
      "Patient Counseling Support",
      "Pharmaceutical Calculations",
      "NDC Verification",
      "Controlled Substances Handling",
      "Quality Control",
      "HIPAA Compliance",
    ],
    certifications: [
      {
        name: "Certified Pharmacy Technician (CPhT)",
        issuer: "Pharmacy Technician Certification Board",
      },
      {
        name: "Sterile Compounding Certification",
        issuer: "Pharmacy Technician Certification Board",
      },
    ],
    degrees: [
      { degree: "Associate of Science", field: "Pharmacy Technology" },
      { degree: "Diploma", field: "Pharmacy Technician" },
    ],
    titles: [
      "Pharmacy Technician",
      "Certified Pharmacy Technician",
      "Lead Pharmacy Technician",
      "Hospital Pharmacy Technician",
    ],
  },
  "Medical Records Technician": {
    headlines: [
      "Medical Records Technician | HIM & Data Integrity",
      "Health Information Technician | EHR & Compliance",
    ],
    summaries: [
      "Meticulous Medical Records Technician with deep expertise in health information management, record retrieval, and data integrity auditing. Proficient in Epic, Cerner, and MEDITECH. Ensures compliance with HIPAA, state regulations, and organizational policies.",
      "Experienced Health Information Technician skilled in electronic health record management, release of information processing, and medical record coding. Strong advocate for data accuracy and patient privacy in all health information workflows.",
    ],
    skills: [
      "Health Information Management",
      "Medical Records Retrieval",
      "Data Integrity Auditing",
      "Epic/Cerner/MEDITECH",
      "HIPAA Compliance",
      "Release of Information",
      "Medical Coding",
      "Chart Deficiency Analysis",
      "Record Scanning & Indexing",
      "Quality Assurance",
      "Patient Privacy",
      "Regulatory Compliance",
    ],
    certifications: [
      {
        name: "Registered Health Information Technician (RHIT)",
        issuer: "AHIMA",
      },
      {
        name: "Certified Coding Specialist (CCS)",
        issuer: "AHIMA",
      },
    ],
    degrees: [
      { degree: "Associate of Science", field: "Health Information Technology" },
      { degree: "Bachelor of Science", field: "Health Information Management" },
    ],
    titles: [
      "Medical Records Technician",
      "Health Information Technician",
      "HIM Specialist",
      "Release of Information Specialist",
      "Medical Records Clerk",
    ],
  },
};

// Position aliases — map variant titles to canonical template keys
const positionAliases: Record<string, string> = {
  "Nursing": "Registered Nurse",
  "Registered Nurse - Med/Surg": "Registered Nurse",
  "Registered Nurse - ICU": "Registered Nurse",
  "Registered Nurse - ER": "Registered Nurse",
  "RN": "Registered Nurse",
  "CNA": "Medical Assistant",
  "CMA": "Medical Assistant",
};

function getPositionData(position: string) {
  return positionData[position] || positionData[positionAliases[position]] || null;
}

// ── Helpers ─────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, arr.length));
}

function randomDate(yearStart: number, yearEnd: number): Date {
  const year = yearStart + Math.floor(Math.random() * (yearEnd - yearStart + 1));
  const month = Math.floor(Math.random() * 12);
  return new Date(year, month, 1);
}

function randomPhone(): string {
  const area = 200 + Math.floor(Math.random() * 800);
  const mid = 200 + Math.floor(Math.random() * 800);
  const end = 1000 + Math.floor(Math.random() * 9000);
  return `${area}-${mid}-${end}`;
}

// ── Main seed function ──────────────────────────────────────

async function main() {
  const candidates = await prisma.candidate.findMany();

  if (candidates.length === 0) {
    console.log("No candidates found in the database. Run seed:candidates first.");
    return;
  }

  console.log(`Found ${candidates.length} candidates. Creating mock profiles...\n`);

  let created = 0;
  let skipped = 0;

  for (const candidate of candidates) {
    // Check if a User already exists for this email
    const existingUser = await prisma.user.findUnique({
      where: { email: candidate.email },
      include: { profile: true },
    });

    if (existingUser?.profile) {
      console.log(`  ~ ${candidate.name} — profile already exists, skipping`);
      skipped++;
      continue;
    }

    const position = candidate.position;
    const data = getPositionData(position);
    if (!data) {
      console.log(`  ! ${candidate.name} — no profile template for "${position}", skipping`);
      skipped++;
      continue;
    }

    const location = pick(cities);
    const headline = pick(data.headlines);
    const summary = pick(data.summaries);
    const selectedSkills = pickN(data.skills, 5 + Math.floor(Math.random() * 4));
    const selectedCerts = pickN(data.certifications, 1 + Math.floor(Math.random() * data.certifications.length));
    const selectedDegree = pick(data.degrees);

    // Generate 2-3 work experiences
    const numExperiences = 2 + Math.floor(Math.random() * 2);
    const experiences: {
      title: string;
      company: string;
      description: string;
      startDate: Date;
      endDate: Date | null;
      current: boolean;
    }[] = [];

    let lastEndYear = 2026;
    for (let i = 0; i < numExperiences; i++) {
      const isCurrent = i === 0;
      const duration = 1 + Math.floor(Math.random() * 4); // 1-4 years
      const endYear = isCurrent ? 2026 : lastEndYear - 1;
      const startYear = endYear - duration;

      experiences.push({
        title: pick(data.titles),
        company: pick(hospitals),
        description: `Provided ${position.toLowerCase()}-related services in a dynamic healthcare environment. Collaborated with multidisciplinary teams to ensure optimal patient outcomes.`,
        startDate: new Date(startYear, Math.floor(Math.random() * 12), 1),
        endDate: isCurrent ? null : new Date(endYear, Math.floor(Math.random() * 12), 1),
        current: isCurrent,
      });

      lastEndYear = startYear;
    }

    // Create or connect User, then build the full profile
    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
      // Update role if not set
      if (!existingUser.role) {
        await prisma.user.update({
          where: { id: userId },
          data: { role: "CANDIDATE" },
        });
      }
    } else {
      const user = await prisma.user.create({
        data: {
          name: candidate.name,
          email: candidate.email,
          role: "CANDIDATE",
        },
      });
      userId = user.id;
    }

    // Create the CandidateProfile with nested relations
    await prisma.candidateProfile.create({
      data: {
        userId,
        headline,
        summary,
        phone: candidate.phone || randomPhone(),
        city: location.city,
        state: location.state,
        country: "United States",
        experiences: {
          create: experiences.map((exp) => ({
            title: exp.title,
            company: exp.company,
            description: exp.description,
            startDate: exp.startDate,
            endDate: exp.endDate,
            current: exp.current,
          })),
        },
        educations: {
          create: [
            {
              school: pick(schools),
              degree: selectedDegree.degree,
              field: selectedDegree.field,
              startDate: randomDate(2010, 2018),
              endDate: randomDate(2014, 2022),
            },
          ],
        },
        skills: {
          create: selectedSkills.map((s) => ({ name: s })),
        },
        certifications: {
          create: selectedCerts.map((c) => ({
            name: c.name,
            issuer: c.issuer,
            issueDate: randomDate(2018, 2024),
            expiryDate: randomDate(2026, 2030),
          })),
        },
      },
    });

    console.log(`  + ${candidate.name} — ${headline}`);
    created++;
  }

  console.log(`\nDone: ${created} profiles created, ${skipped} skipped.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
