import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { EligibleCandidate, EngineProduct, Recommendation, RuleSetDefinition } from "./types";
import { ruleBasedExplanation } from "./engine";
import { formatAmount } from "./units";

const DEFAULT_MODEL = "claude-opus-5-5";

const rankingSchema = z.object({
  ranking: z.array(
    z.object({
      code: z.string(),
      explanation: z.string(),
    }),
  ),
});

export interface RankingOutcome {
  recommendations: Recommendation[];
  source: "ai" | "rules";
  sourceNote: string;
  model?: string;
  aiLatencyMs?: number;
}

function ruleBased(eligible: EligibleCandidate[], max: number, note: string): RankingOutcome {
  return {
    recommendations: eligible.slice(0, max).map((e, i) => ({ ...e, rank: i + 1, explanation: ruleBasedExplanation(e) })),
    source: "rules",
    sourceNote: note,
  };
}

function describe(p: EngineProduct): string {
  const attrs = Object.entries(p.attributes ?? {})
    .map(([k, v]) => `${k}=${String(v)}`)
    .join(", ");
  return `${p.code} | ${p.name} | ${p.category} | ${p.packageQuantity} ${p.packageUnit} | ${p.price.toFixed(2)} € | attributes: ${attrs || "none"} | ingredients: ${p.ingredients ?? "n/a"}`;
}

/**
 * Rank the eligible candidates with Claude. Only products that already passed
 * every mandatory rule are sent; the model may only reorder them and write a
 * short explanation. All figures come from the engine, never from the model.
 */
export async function rankWithAi(
  rules: RuleSetDefinition,
  original: EngineProduct,
  orderedQuantity: number,
  eligible: EligibleCandidate[],
): Promise<RankingOutcome> {
  const max = rules.maxRecommendations;
  if (eligible.length === 0) return ruleBased(eligible, max, "No product passed the mandatory rules.");
  if (!process.env.ANTHROPIC_API_KEY) {
    return ruleBased(eligible, max, "AI ranking is not configured (ANTHROPIC_API_KEY missing); showing rule-based ranking.");
  }

  const client = new Anthropic();
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
  const started = Date.now();

  const candidateLines = eligible
    .map(
      (e) =>
        `- ${describe(e.product)} | replacement quantity: ${e.replacementQuantity} (= ${Number.isFinite(e.replacementTotalAmount) ? formatAmount(e.replacementTotalAmount, e.amountUnit) : "n/a"}) | total ${e.substituteCost.toFixed(2)} € | difference ${e.costDifference >= 0 ? "+" : ""}${e.costDifference.toFixed(2)} € (${e.costDifferencePercent.toFixed(0)} %) | preference score ${e.preferenceScore}${e.preferenceMatches.length ? " (" + e.preferenceMatches.join(", ") + ")" : ""}`,
    )
    .join("\n");

  const preferences = rules.preferences.map((p) => `- ${p.description ?? p.id} (weight ${p.weight})`).join("\n");

  const system = `You help online grocery order pickers choose a substitute for an unavailable product.
You receive the unavailable product, the ordered quantity and a list of candidate products that have ALREADY passed every mandatory company rule (category, price limit, quantity tolerance, dietary properties). Replacement quantities and costs were calculated by the system and are final.

Your task: order the candidates from most to least suitable for the customer and give a one-sentence explanation per candidate in plain English for the picker. Return at most ${max} candidates.

Rules:
- Use only the information given. Never invent product details, prices or quantities. Do not state numbers other than those provided.
- Base the order on the company's preferences, listed below, and on what a customer who ordered the original product would most likely accept (same brand, same variant, same type and flavour, similar size, small price difference).
- Each explanation must mention the main reason this product fits and, when relevant, the price or quantity difference exactly as given.
- Only use codes from the candidate list.

Company preferences:
${preferences || "- (none specified)"}`;

  const user = `Unavailable product: ${describe(original)}
Ordered quantity: ${orderedQuantity} package(s) (= ${formatAmount(eligible[0].originalTotalAmount, eligible[0].amountUnit)}), order line total ${eligible[0].originalCost.toFixed(2)} €.

Candidates (all passed the mandatory rules):
${candidateLines}`;

  try {
    const response = await client.messages.parse({
      model,
      max_tokens: 4000,
      output_config: { effort: "medium", format: zodOutputFormat(rankingSchema) },
      system,
      messages: [{ role: "user", content: user }],
    });
    const aiLatencyMs = Date.now() - started;

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return { ...ruleBased(eligible, max, "AI ranking was unavailable for this request; showing rule-based ranking."), aiLatencyMs };
    }

    const byCode = new Map(eligible.map((e) => [e.product.code, e]));
    const used = new Set<string>();
    const recommendations: Recommendation[] = [];
    for (const item of response.parsed_output.ranking) {
      const e = byCode.get(item.code);
      if (!e || used.has(item.code)) continue; // ignore unknown or duplicated codes
      used.add(item.code);
      const explanation = item.explanation.trim() || ruleBasedExplanation(e);
      recommendations.push({ ...e, rank: recommendations.length + 1, explanation });
      if (recommendations.length >= max) break;
    }
    // Fill up with rule-based order if the model returned fewer than allowed.
    for (const e of eligible) {
      if (recommendations.length >= max) break;
      if (used.has(e.product.code)) continue;
      used.add(e.product.code);
      recommendations.push({ ...e, rank: recommendations.length + 1, explanation: ruleBasedExplanation(e) });
    }
    return { recommendations, source: "ai", sourceNote: `Ranked by ${model}; quantities and prices calculated by the system.`, model, aiLatencyMs };
  } catch (err) {
    const aiLatencyMs = Date.now() - started;
    const reason =
      err instanceof Anthropic.AuthenticationError
        ? "AI service rejected the API key"
        : err instanceof Anthropic.RateLimitError
          ? "AI service rate limit reached"
          : err instanceof Anthropic.APIConnectionError
            ? "AI service could not be reached"
            : err instanceof Anthropic.APIError
              ? `AI service error (${err.status})`
              : "AI ranking failed";
    console.error("AI ranking failed:", err);
    return { ...ruleBased(eligible, max, `${reason}; showing rule-based ranking instead.`), aiLatencyMs };
  }
}
