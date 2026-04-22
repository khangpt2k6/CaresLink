/**
 * Apply a SQL migration file to Flutter Supabase via Prisma raw SQL.
 *
 * Usage:
 *   npx tsx scripts/run-migration.ts supabase/migrations/0002_credential_checks.sql
 */

import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: npx tsx scripts/run-migration.ts <path-to.sql>");
    process.exit(1);
  }
  const sql = readFileSync(resolve(file), "utf8");
  const prisma = new PrismaClient();

  // Split into top-level statements, respecting `$$ ... $$` dollar-quoted
  // blocks (function bodies contain their own `;` that must not split).
  const statements: string[] = [];
  let buf = "";
  let inDollar = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    // Detect $$ toggles (works for simple $$ markers; no tagged $foo$ in our files)
    if (ch === "$" && sql[i + 1] === "$") {
      inDollar = !inDollar;
      buf += "$$";
      i++;
      continue;
    }
    if (ch === ";" && !inDollar) {
      const stripped = buf.trim();
      if (stripped.length > 0) statements.push(stripped);
      buf = "";
      continue;
    }
    buf += ch;
  }
  const tail = buf.trim();
  if (tail.length > 0) statements.push(tail);

  console.log(`Applying ${statements.length} statements from ${file}`);
  for (const [i, stmt] of statements.entries()) {
    try {
      await prisma.$executeRawUnsafe(stmt);
      console.log(`  [${i + 1}/${statements.length}] ok: ${stmt.split("\n")[0].slice(0, 80)}`);
    } catch (e) {
      console.error(`  [${i + 1}/${statements.length}] FAILED:`, stmt.slice(0, 120));
      throw e;
    }
  }
  await prisma.$disconnect();
  console.log("\n✓ Migration applied");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
