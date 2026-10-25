import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/api";
import { evaluateCandidates } from "@/lib/substitution/engine";
import { parseRules, toEngineProduct } from "@/lib/substitution";
import { round2 } from "@/lib/substitution/units";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  datasetId: z.string().min(1),
  ruleSetId: z.string().min(1),
  pickerName: z.string().trim().max(80).optional(),
  originalProductCode: z.string().min(1),
  orderedQuantity: z.coerce.number().positive().max(1000),
  outcome: z.enum(["ACCEPTED_RECOMMENDATION", "MANUAL_SELECTION", "NO_SUBSTITUTE"]),
  selectedProductCode: z.string().optional(),
  selectedQuantity: z.coerce.number().positive().max(1000).optional(),
  recommendationRank: z.number().int().positive().optional(),
  recommendations: z.array(z.object({ rank: z.number(), code: z.string(), replacementQuantity: z.number(), costDifference: z.number(), explanation: z.string() })).optional(),
  recommendationSource: z.string().optional(),
  durationMs: z.number().int().nonnegative().optional(),
  isMock: z.boolean().optional(),
});

/** Record a substitution decision. Costs are recalculated server-side from the dataset. */
export async function POST(req: Request) {
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid decision payload." }, { status: 400 });
    const b = parsed.data;
    if (b.outcome !== "NO_SUBSTITUTE" && (!b.selectedProductCode || !b.selectedQuantity)) {
      return NextResponse.json({ error: "A substitute product and quantity are required." }, { status: 400 });
    }

    const [dataset, ruleSet, original] = await Promise.all([
      prisma.dataset.findUnique({ where: { id: b.datasetId } }),
      prisma.ruleSet.findUnique({ where: { id: b.ruleSetId } }),
      prisma.product.findUnique({ where: { datasetId_code: { datasetId: b.datasetId, code: b.originalProductCode } } }),
    ]);
    if (!dataset || !ruleSet) return NextResponse.json({ error: "Dataset or rule set no longer exists." }, { status: 404 });
    if (!original) return NextResponse.json({ error: "Original product not found in the dataset." }, { status: 404 });

    const originalCost = round2(Number(original.price) * b.orderedQuantity);
    let substituteCost: number | null = null;
    let costDifference: number | null = null;
    let selectedName: string | null = null;

    if (b.outcome !== "NO_SUBSTITUTE") {
      const selected = await prisma.product.findUnique({ where: { datasetId_code: { datasetId: b.datasetId, code: b.selectedProductCode! } } });
      if (!selected) return NextResponse.json({ error: "Selected product not found in the dataset." }, { status: 404 });
      if (selected.code === original.code) return NextResponse.json({ error: "The substitute cannot be the original product." }, { status: 400 });
      // Enforce mandatory rules server-side as well.
      const rules = parseRules(ruleSet.rules);
      const evaluation = evaluateCandidates(rules, toEngineProduct(original), b.orderedQuantity, [toEngineProduct(selected)]);
      if (evaluation.eligible.length === 0) {
        const reasons = evaluation.rejected[0]?.checks.filter((c) => !c.passed).map((c) => c.detail) ?? [];
        return NextResponse.json({ error: `This product does not meet the mandatory rules: ${reasons.join("; ")}` }, { status: 422 });
      }
      selectedName = selected.name;
      substituteCost = round2(Number(selected.price) * b.selectedQuantity!);
      costDifference = round2(substituteCost - originalCost);
    }

    const decision = await prisma.substitutionDecision.create({
      data: {
        datasetId: dataset.id,
        ruleSetId: ruleSet.id,
        pickerName: b.pickerName || null,
        originalProductCode: original.code,
        originalProductName: original.name,
        orderedQuantity: new Prisma.Decimal(b.orderedQuantity),
        outcome: b.outcome,
        selectedProductCode: b.outcome === "NO_SUBSTITUTE" ? null : b.selectedProductCode,
        selectedProductName: selectedName,
        selectedQuantity: b.outcome === "NO_SUBSTITUTE" ? null : new Prisma.Decimal(b.selectedQuantity!),
        recommendationRank: b.recommendationRank ?? null,
        originalCost: new Prisma.Decimal(originalCost),
        substituteCost: substituteCost === null ? null : new Prisma.Decimal(substituteCost),
        costDifference: costDifference === null ? null : new Prisma.Decimal(costDifference),
        recommendations: (b.recommendations ?? null) as Prisma.InputJsonValue | null ?? Prisma.JsonNull,
        recommendationSource: b.recommendationSource ?? null,
        durationMs: b.durationMs ?? null,
        isMock: b.isMock ?? dataset.isSample,
      },
    });
    return NextResponse.json({ id: decision.id, originalCost, substituteCost, costDifference }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
