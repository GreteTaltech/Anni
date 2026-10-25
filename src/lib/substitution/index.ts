import { Prisma, Product } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { evaluateCandidates } from "./engine";
import { rankWithAi } from "./ai";
import { EngineProduct, ruleSetSchema, RuleSetDefinition, SubstitutionResult } from "./types";

export function toEngineProduct(p: Product): EngineProduct {
  return {
    code: p.code,
    name: p.name,
    category: p.category,
    packageQuantity: Number(p.packageQuantity),
    packageUnit: p.packageUnit,
    price: Number(p.price),
    ingredients: p.ingredients,
    attributes: (p.attributes && typeof p.attributes === "object" && !Array.isArray(p.attributes) ? p.attributes : {}) as Record<string, unknown>,
    available: p.available,
    sourceUrl: p.sourceUrl,
  };
}

export function parseRules(json: Prisma.JsonValue): RuleSetDefinition {
  return ruleSetSchema.parse(json);
}

export class SubstitutionError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

/** Active dataset and rule set, or an error explaining what is missing. */
export async function getActiveConfiguration() {
  const [dataset, ruleSet] = await Promise.all([
    prisma.dataset.findFirst({ where: { isActive: true }, orderBy: { version: "desc" } }),
    prisma.ruleSet.findFirst({ where: { isActive: true }, orderBy: { version: "desc" } }),
  ]);
  if (!dataset) throw new SubstitutionError("No active product dataset. Import products in the researcher dashboard.", 409);
  if (!ruleSet) throw new SubstitutionError("No active substitution rules. Import rules in the researcher dashboard.", 409);
  return { dataset, ruleSet, rules: parseRules(ruleSet.rules) };
}

export async function findSubstitutes(originalCode: string, orderedQuantity: number): Promise<SubstitutionResult & { datasetId: string; ruleSetId: string }> {
  if (!Number.isFinite(orderedQuantity) || orderedQuantity <= 0) throw new SubstitutionError("Ordered quantity must be a positive number.");
  const { dataset, ruleSet, rules } = await getActiveConfiguration();
  const originalRow = await prisma.product.findUnique({ where: { datasetId_code: { datasetId: dataset.id, code: originalCode } } });
  if (!originalRow) throw new SubstitutionError(`Product ${originalCode} not found in the active dataset.`, 404);
  const original = toEngineProduct(originalRow);

  // Candidate pool: everything in the same category (mandatory rules do the rest).
  const sameCategoryRequired = rules.mandatory.some((r) => r.type === "same_category");
  const rows = await prisma.product.findMany({
    where: { datasetId: dataset.id, ...(sameCategoryRequired ? { category: originalRow.category } : {}) },
    orderBy: { name: "asc" },
  });
  const candidates = rows.map(toEngineProduct);

  const evaluation = evaluateCandidates(rules, original, orderedQuantity, candidates);
  const ranking = await rankWithAi(rules, original, orderedQuantity, evaluation.eligible);

  return {
    original,
    orderedQuantity,
    originalCost: evaluation.originalCost,
    recommendations: ranking.recommendations,
    eligible: evaluation.eligible,
    rejected: evaluation.rejected,
    source: ranking.source,
    sourceNote: ranking.sourceNote,
    model: ranking.model,
    aiLatencyMs: ranking.aiLatencyMs,
    datasetId: dataset.id,
    ruleSetId: ruleSet.id,
  };
}
