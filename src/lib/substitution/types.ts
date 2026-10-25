import { z } from "zod";

/** Product as used by the substitution engine (plain numbers, not Decimals). */
export interface EngineProduct {
  code: string;
  name: string;
  category: string;
  packageQuantity: number;
  packageUnit: string;
  price: number;
  ingredients: string | null;
  attributes: Record<string, unknown>;
  available: boolean;
  sourceUrl?: string | null;
}

const mandatoryRule = z.discriminatedUnion("type", [
  z.object({ id: z.string(), type: z.literal("same_category"), description: z.string().optional() }),
  z.object({
    id: z.string(),
    type: z.literal("price_limit"),
    maxIncreasePercent: z.number().nonnegative().optional(),
    maxIncreaseAbsolute: z.number().nonnegative().optional(),
    description: z.string().optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("quantity_tolerance"),
    maxDeviationPercent: z.number().nonnegative(),
    description: z.string().optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("preserve_attributes"),
    attributes: z.array(z.string()).min(1),
    description: z.string().optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("same_unit"),
    description: z.string().optional(),
  }),
]);

const preferenceRule = z.discriminatedUnion("type", [
  z.object({
    id: z.string(),
    type: z.literal("same_attribute"),
    attribute: z.string(),
    weight: z.number().default(1),
    description: z.string().optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("attribute_equals"),
    attribute: z.string(),
    value: z.union([z.string(), z.number(), z.boolean()]),
    weight: z.number().default(1),
    description: z.string().optional(),
  }),
  z.object({ id: z.string(), type: z.literal("closest_price"), weight: z.number().default(1), description: z.string().optional() }),
  z.object({ id: z.string(), type: z.literal("closest_package"), weight: z.number().default(1), description: z.string().optional() }),
]);

export const ruleSetSchema = z.object({
  name: z.string().default("Substitution rules"),
  description: z.string().optional(),
  maxRecommendations: z.number().int().min(1).max(10).default(3),
  quantity: z
    .object({
      rounding: z.enum(["up", "nearest", "down"]).default("up"),
      note: z.string().optional(),
    })
    .default({ rounding: "up" }),
  mandatory: z.array(mandatoryRule).default([]),
  preferences: z.array(preferenceRule).default([]),
});

export type RuleSetDefinition = z.infer<typeof ruleSetSchema>;
export type MandatoryRule = z.infer<typeof mandatoryRule>;
export type PreferenceRule = z.infer<typeof preferenceRule>;

export interface RuleCheck {
  ruleId: string;
  passed: boolean;
  detail: string;
}

/** A candidate that passed every mandatory rule, with code-computed figures. */
export interface EligibleCandidate {
  product: EngineProduct;
  replacementQuantity: number;
  replacementTotalAmount: number;
  originalTotalAmount: number;
  amountUnit: string;
  quantityDeviationPercent: number;
  originalCost: number;
  substituteCost: number;
  costDifference: number;
  costDifferencePercent: number;
  unitPriceOriginal: number;
  unitPriceSubstitute: number;
  checks: RuleCheck[];
  preferenceScore: number;
  preferenceMatches: string[];
}

export interface RejectedCandidate {
  product: EngineProduct;
  checks: RuleCheck[];
}

export interface Recommendation extends EligibleCandidate {
  rank: number;
  explanation: string;
}

export interface SubstitutionResult {
  original: EngineProduct;
  orderedQuantity: number;
  originalCost: number;
  recommendations: Recommendation[];
  eligible: EligibleCandidate[];
  rejected: RejectedCandidate[];
  source: "ai" | "rules";
  sourceNote: string;
  model?: string;
  aiLatencyMs?: number;
}
