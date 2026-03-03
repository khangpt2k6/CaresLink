import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const candidate = await prisma.candidate.upsert({
    where: { id: "seed-cand-1" },
    update: {},
    create: {
      id: "seed-cand-1",
      name: "Jane Doe",
      email: "jane.doe@example.com",
      phone: "+15551234567",
      position: "Software Engineer",
      status: "applied",
    },
  });

  await prisma.candidate.upsert({
    where: { id: "seed-cand-2" },
    update: {},
    create: {
      id: "seed-cand-2",
      name: "John Smith",
      email: "john.smith@example.com",
      phone: "+15559876543",
      position: "Product Manager",
      status: "contacted",
    },
  });

  await prisma.interview.create({
    data: {
      candidateId: candidate.id,
      position: "Software Engineer",
      scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      duration: 60,
      location: "Video Call",
      reminderSent: false,
    },
  });

  await prisma.event.createMany({
    data: [
      { type: "email_sent", candidateId: candidate.id, channel: "email", cost: 0.02 },
      { type: "sms_sent", candidateId: candidate.id, channel: "sms", cost: 0.05 },
      { type: "interview_scheduled", candidateId: candidate.id },
      { type: "reminder_sent", candidateId: candidate.id, channel: "sms" },
      { type: "email_opened", candidateId: candidate.id, channel: "email" },
      { type: "sms_replied", candidateId: candidate.id, channel: "sms" },
    ],
  });

  console.log("Seed completed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
