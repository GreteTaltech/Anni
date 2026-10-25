import {
  EligibleCandidate,
  EngineProduct,
  MandatoryRule,
  PreferenceRule,
  RejectedCandidate,
  RuleCheck,
  RuleSetDefinition,
} from "./types";
import { formatAmount, round2, toBaseAmount } from "./units";

/**
 * Deterministic part of the substitution logic. Every number shown to the
 * user (quantities, costs, differences) is computed here, never by the AI.
 */

function attr(p: EngineProduct, key: string): unknown {
  return p.attributes?.[key];
}

function truthy(v: unknown): boolean {
  return v === true || v === "true" || v === 1 || v === "1" || v === "yes";
}

function computeQuantity(
  original: EngineProduct,
  orderedQuantity: number,
  candidate: EngineProduct,
  rounding: RuleSetDefinition["quantity"]["rounding"],
) {
  const o = toBaseAmount(original.packageQuantity, original.packageUnit);
  const c = toBaseAmount(candidate.packageQuantity, candidate.packageUnit);
  const originalTotalAmount = o.amount * orderedQuantity;
  const sameUnit = o.base === c.base;
  let replacementQuantity: number;
  if (!sameUnit || c.amount <= 0) {
    replacementQuantity = orderedQuantity; // fall back to a 1:1 package replacement
  } else {
    const raw = originalTotalAmount / c.amount;
    replacementQuantity =
      rounding === "up" ? Math.ceil(raw - 1e-9) : rounding === "down" ? Math.floor(raw + 1e-9) : Math.round(raw);
  }
  replacementQuantity = Math.max(1, replacementQuantity);
  const replacementTotalAmount = sameUnit ? c.amount * replacementQuantity : NaN;
  const quantityDeviationPercent = sameUnit
    ? round2(((replacementTotalAmount - originalTotalAmount) / originalTotalAmount) * 100)
    : NaN;
  return { originalTotalAmount, replacementQuantity, replacementTotalAmount, quantityDeviationPercent, sameUnit, base: o.base, candBase: c.base };
}

function checkMandatory(
  rule: MandatoryRule,
  original: EngineProduct,
  candidate: EngineProduct,
  q: ReturnType<typeof computeQuantity>,
  costs: { originalCost: number; substituteCost: number; costDifference: number; costDifferencePercent: number },
): RuleCheck {
  switch (rule.type) {
    case "same_category": {
      const passed = original.category.trim().toLowerCase() === candidate.category.trim().toLowerCase();
      return { ruleId: rule.id, passed, detail: passed ? `Same category (${candidate.category})` : `Different category (${candidate.category} vs ${original.category})` };
    }
    case "same_unit": {
      return { ruleId: rule.id, passed: q.sameUnit, detail: q.sameUnit ? `Comparable units (${q.base})` : `Units not comparable (${original.packageUnit} vs ${candidate.packageUnit})` };
    }
    case "price_limit": {
      const diff = costs.costDifference;
      if (diff <= 0) return { ruleId: rule.id, passed: true, detail: `Not more expensive (${diff.toFixed(2)} €)` };
      const limits: number[] = [];
      if (rule.maxIncreasePercent !== undefined) limits.push(costs.originalCost * (rule.maxIncreasePercent / 100));
      if (rule.maxIncreaseAbsolute !== undefined) limits.push(rule.maxIncreaseAbsolute);
      const limit = limits.length ? Math.min(...limits) : Infinity;
      const passed = diff <= limit + 1e-9;
      return {
        ruleId: rule.id,
        passed,
        detail: passed
          ? `Price increase ${diff.toFixed(2)} € (${costs.costDifferencePercent.toFixed(0)} %) within limit ${limit.toFixed(2)} €`
          : `Price increase ${diff.toFixed(2)} € (${costs.costDifferencePercent.toFixed(0)} %) exceeds limit ${limit.toFixed(2)} €`,
      };
    }
    case "quantity_tolerance": {
      if (!q.sameUnit) return { ruleId: rule.id, passed: false, detail: "Amount cannot be compared (different units)" };
      const dev = Math.abs(q.quantityDeviationPercent);
      const passed = dev <= rule.maxDeviationPercent + 1e-9;
      return {
        ruleId: rule.id,
        passed,
        detail: `${formatAmount(q.replacementTotalAmount, q.base)} vs ordered ${formatAmount(q.originalTotalAmount, q.base)} (${q.quantityDeviationPercent > 0 ? "+" : ""}${q.quantityDeviationPercent.toFixed(0)} %, limit ±${rule.maxDeviationPercent} %)`,
      };
    }
    case "preserve_attributes": {
      const missing = rule.attributes.filter((a) => truthy(attr(original, a)) && !truthy(attr(candidate, a)));
      const required = rule.attributes.filter((a) => truthy(attr(original, a)));
      if (required.length === 0) return { ruleId: rule.id, passed: true, detail: "No dietary property to preserve" };
      return {
        ruleId: rule.id,
        passed: missing.length === 0,
        detail: missing.length === 0 ? `Keeps ${required.map(label).join(", ")}` : `Missing ${missing.map(label).join(", ")}`,
      };
    }
  }
}

function label(key: string): string {
  return key.replace(/_/g, "-");
}

function scorePreferences(
  rules: PreferenceRule[],
  original: EngineProduct,
  candidate: EngineProduct,
  cand: { costDifference: number; packageRatio: number },
  maxAbsCostDiff: number,
): { score: number; matches: string[] } {
  let score = 0;
  const matches: string[] = [];
  for (const r of rules) {
    switch (r.type) {
      case "same_attribute": {
        const a = attr(original, r.attribute);
        const b = attr(candidate, r.attribute);
        if (a !== undefined && a !== null && a !== "" && String(a).toLowerCase() === String(b ?? "").toLowerCase()) {
          score += r.weight;
          matches.push(`same ${label(r.attribute)}`);
        }
        break;
      }
      case "attribute_equals": {
        const b = attr(candidate, r.attribute);
        if (String(b ?? "").toLowerCase() === String(r.value).toLowerCase()) {
          score += r.weight;
          matches.push(`${label(r.attribute)} ${String(r.value)}`);
        }
        break;
      }
      case "closest_price": {
        // 0..weight, full weight when price difference is zero
        const rel = maxAbsCostDiff > 0 ? 1 - Math.min(1, Math.abs(cand.costDifference) / maxAbsCostDiff) : 1;
        score += r.weight * rel;
        if (Math.abs(cand.costDifference) < 0.005) matches.push("same price");
        break;
      }
      case "closest_package": {
        const rel = 1 - Math.min(1, Math.abs(1 - cand.packageRatio));
        score += r.weight * rel;
        if (Math.abs(1 - cand.packageRatio) < 1e-6) matches.push("same package size");
        break;
      }
    }
  }
  return { score: round2(score), matches };
}

export interface EvaluationResult {
  originalCost: number;
  eligible: EligibleCandidate[];
  rejected: RejectedCandidate[];
}

/**
 * Apply mandatory rules to every candidate and compute quantities and costs.
 * Returns eligible candidates sorted by preference score (best first).
 */
export function evaluateCandidates(
  rules: RuleSetDefinition,
  original: EngineProduct,
  orderedQuantity: number,
  candidates: EngineProduct[],
): EvaluationResult {
  const originalCost = round2(original.price * orderedQuantity);
  const o = toBaseAmount(original.packageQuantity, original.packageUnit);
  const eligible: EligibleCandidate[] = [];
  const rejected: RejectedCandidate[] = [];

  for (const candidate of candidates) {
    if (candidate.code === original.code) continue;
    const checks: RuleCheck[] = [];
    if (!candidate.available) {
      checks.push({ ruleId: "availability", passed: false, detail: "Not available" });
      rejected.push({ product: candidate, checks });
      continue;
    }
    const q = computeQuantity(original, orderedQuantity, candidate, rules.quantity.rounding);
    const substituteCost = round2(candidate.price * q.replacementQuantity);
    const costDifference = round2(substituteCost - originalCost);
    const costDifferencePercent = originalCost > 0 ? round2((costDifference / originalCost) * 100) : 0;
    const costs = { originalCost, substituteCost, costDifference, costDifferencePercent };

    for (const rule of rules.mandatory) checks.push(checkMandatory(rule, original, candidate, q, costs));

    if (checks.some((c) => !c.passed)) {
      rejected.push({ product: candidate, checks });
      continue;
    }
    const c = toBaseAmount(candidate.packageQuantity, candidate.packageUnit);
    eligible.push({
      product: candidate,
      replacementQuantity: q.replacementQuantity,
      replacementTotalAmount: q.replacementTotalAmount,
      originalTotalAmount: q.originalTotalAmount,
      amountUnit: q.base,
      quantityDeviationPercent: q.quantityDeviationPercent,
      originalCost,
      substituteCost,
      costDifference,
      costDifferencePercent,
      unitPriceOriginal: o.amount > 0 ? round2((original.price / o.amount) * (o.base === "pcs" ? 1 : 1000)) : original.price,
      unitPriceSubstitute: c.amount > 0 ? round2((candidate.price / c.amount) * (c.base === "pcs" ? 1 : 1000)) : candidate.price,
      checks,
      preferenceScore: 0,
      preferenceMatches: [],
    });
  }

  const maxAbsCostDiff = Math.max(0, ...eligible.map((e) => Math.abs(e.costDifference)));
  for (const e of eligible) {
    const c = toBaseAmount(e.product.packageQuantity, e.product.packageUnit);
    const packageRatio = o.amount > 0 && o.base === c.base ? c.amount / o.amount : 1;
    const { score, matches } = scorePreferences(rules.preferences, original, e.product, { costDifference: e.costDifference, packageRatio }, maxAbsCostDiff);
    e.preferenceScore = score;
    e.preferenceMatches = matches;
  }
  eligible.sort((a, b) => b.preferenceScore - a.preferenceScore || Math.abs(a.costDifference) - Math.abs(b.costDifference) || a.product.name.localeCompare(b.product.name));
  return { originalCost, eligible, rejected };
}

/** Template explanation used when AI ranking is unavailable. */
export function ruleBasedExplanation(e: EligibleCandidate): string {
  const parts: string[] = [];
  if (e.preferenceMatches.length) parts.push(e.preferenceMatches.slice(0, 3).join(", "));
  const diff = e.costDifference;
  if (Math.abs(diff) < 0.005) {
    if (!e.preferenceMatches.includes("same price")) parts.push("same total price");
  }
  else if (diff < 0) parts.push(`${Math.abs(diff).toFixed(2)} € cheaper in total`);
  else parts.push(`${diff.toFixed(2)} € more in total, within the allowed limit`);
  if (Number.isFinite(e.quantityDeviationPercent) && Math.abs(e.quantityDeviationPercent) >= 1)
    parts.push(`${e.replacementQuantity} × ${e.product.packageQuantity} ${e.product.packageUnit} gives ${e.quantityDeviationPercent > 0 ? "+" : ""}${e.quantityDeviationPercent.toFixed(0)} % of the ordered amount`);
  const s = parts.join("; ");
  return s.charAt(0).toUpperCase() + s.slice(1) + ".";
}
