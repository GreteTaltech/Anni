/**
 * Idempotent seed: imports the sample dataset and rules from /data when the
 * database has no dataset or rule set yet. Safe to run on every start.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const dataDir = join(process.cwd(), "data");
  const datasets = await prisma.dataset.count();
  const ruleSets = await prisma.ruleSet.count();
  if (datasets > 0 && ruleSets > 0) {
    console.log("Seed: database already has data, nothing to do.");
    return;
  }
  // Import helpers are TypeScript modules under src; load them lazily so the
  // seed can run with tsx without Next.js.
  const { importDataset, importRuleSet } = await import("../src/lib/import");
  if (datasets === 0) {
    const ds = await importDataset(readFileSync(join(dataDir, "products.csv"), "utf8"), "Sample dataset (fictional prices)", { isSample: true, activate: true });
    console.log(`Seed: imported sample dataset v${ds.version} with ${ds._count.products} products.`);
  }
  if (ruleSets === 0) {
    const rs = await importRuleSet(readFileSync(join(dataDir, "substitution_rules.json"), "utf8"), undefined, { activate: true });
    console.log(`Seed: imported rule set v${rs.version} (${rs.name}).`);
  }
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
