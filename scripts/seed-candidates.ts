import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

async function main() {
  const csvPath = path.join(process.cwd(), "candidates-mock.csv");
  const raw = fs.readFileSync(csvPath, "utf-8");
  const lines = raw.trim().split(/\r?\n/).filter(Boolean);

  let created = 0;
  let skipped = 0;

  for (const line of lines) {
    const [name, email, phone, position] = line.split(",").map((p) => p.trim());
    const emailLower = email.toLowerCase();
    if (!name || !emailLower) {
      skipped++;
      continue;
    }

    const existing = await prisma.candidate.findFirst({ where: { email: emailLower } });
    if (existing) {
      skipped++;
      continue;
    }

    await prisma.candidate.create({
      data: {
        name,
        email: emailLower,
        phone: phone || null,
        position: position || "General",
      },
    });
    created++;
    console.log(`  + ${name} (${emailLower})`);
  }

  console.log(`\nDone: ${created} created, ${skipped} skipped.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
