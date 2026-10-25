import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toCsv } from "@/lib/csv";
import { errorResponse, unauthorized } from "@/lib/api";
import { isResearcher } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    if (!(await isResearcher())) return unauthorized();
    const url = new URL(req.url);
    const includeMock = url.searchParams.get("includeMock") === "1";
    const rows = await prisma.substitutionDecision.findMany({
      where: includeMock ? {} : { isMock: false },
      orderBy: { createdAt: "asc" },
      include: { dataset: { select: { version: true } }, ruleSet: { select: { version: true } } },
    });
    const columns = [
      "decision_id", "created_at", "picker_name", "dataset_version", "rule_set_version", "original_product_code", "original_product_name",
      "ordered_quantity", "outcome", "selected_product_code", "selected_product_name", "selected_quantity", "recommendation_rank",
      "original_cost_eur", "substitute_cost_eur", "cost_difference_eur", "recommendation_source", "duration_ms", "is_mock",
    ];
    const data = rows.map((r) => ({
      decision_id: r.id,
      created_at: r.createdAt,
      picker_name: r.pickerName,
      dataset_version: r.dataset.version,
      rule_set_version: r.ruleSet.version,
      original_product_code: r.originalProductCode,
      original_product_name: r.originalProductName,
      ordered_quantity: r.orderedQuantity,
      outcome: r.outcome,
      selected_product_code: r.selectedProductCode,
      selected_product_name: r.selectedProductName,
      selected_quantity: r.selectedQuantity,
      recommendation_rank: r.recommendationRank,
      original_cost_eur: r.originalCost,
      substitute_cost_eur: r.substituteCost,
      cost_difference_eur: r.costDifference,
      recommendation_source: r.recommendationSource,
      duration_ms: r.durationMs,
      is_mock: r.isMock,
    }));
    const csv = toCsv(columns, data);
    return new NextResponse("﻿" + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="substitution-decisions-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
