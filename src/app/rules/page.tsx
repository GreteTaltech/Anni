import { ShieldCheck, Scale, Calculator } from "lucide-react";
import { prisma, isDatabaseError } from "@/lib/prisma";
import { parseRules } from "@/lib/substitution";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import type { MandatoryRule, PreferenceRule } from "@/lib/substitution/types";

export const dynamic = "force-dynamic";

function mandatoryText(r: MandatoryRule): string {
  if (r.description) return r.description;
  switch (r.type) {
    case "same_category":
      return "The substitute must be in the same category.";
    case "price_limit":
      return `Total cost may increase by at most ${r.maxIncreasePercent ?? "–"} % / ${r.maxIncreaseAbsolute?.toFixed(2) ?? "–"} €.`;
    case "quantity_tolerance":
      return `Total amount may deviate by at most ±${r.maxDeviationPercent} %.`;
    case "preserve_attributes":
      return `Must keep: ${r.attributes.join(", ")}.`;
    case "same_unit":
      return "Package units must be comparable.";
  }
}

function preferenceText(r: PreferenceRule): string {
  if (r.description) return r.description;
  switch (r.type) {
    case "same_attribute":
      return `Prefer the same ${r.attribute}.`;
    case "attribute_equals":
      return `Prefer ${r.attribute} = ${String(r.value)}.`;
    case "closest_price":
      return "Prefer the smallest price difference.";
    case "closest_package":
      return "Prefer the closest package size.";
  }
}

export default async function RulesPage() {
  let ruleSet: Awaited<ReturnType<typeof prisma.ruleSet.findFirst>> = null;
  let error: string | null = null;
  try {
    ruleSet = await prisma.ruleSet.findFirst({ where: { isActive: true }, orderBy: { version: "desc" } });
  } catch (err) {
    error = isDatabaseError(err) ? "The database is not reachable right now. Please try again in a moment." : "Could not load the rules.";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Substitution rules</h1>
        <p className="mt-1 text-sm text-muted">
          These are the company rules the assistant applies. Mandatory requirements are checked in code before any AI ranking; preferences only affect the order of eligible products.
        </p>
      </div>
      {error ? <Alert variant="error">{error}</Alert> : null}
      {!error && !ruleSet ? <Alert variant="warning">No active rule set. Import one in the researcher dashboard.</Alert> : null}
      {ruleSet ? <RuleSetView ruleSet={ruleSet} /> : null}
    </div>
  );
}

function RuleSetView({ ruleSet }: { ruleSet: NonNullable<Awaited<ReturnType<typeof prisma.ruleSet.findFirst>>> }) {
  const rules = parseRules(ruleSet.rules);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
        <Badge variant="secondary">Version {ruleSet.version}</Badge>
        <span>{ruleSet.name}</span>
        <span>· imported {ruleSet.createdAt.toLocaleDateString("en-GB")}</span>
        <span>· up to {rules.maxRecommendations} recommendations</span>
      </div>
      {rules.description ? <p className="text-sm">{rules.description}</p> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-accent" /> Mandatory requirements
            </CardTitle>
            <CardDescription>A product that fails any of these is never recommended and cannot be selected manually.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {rules.mandatory.map((r, i) => (
                <li key={r.id} className="flex gap-3 text-sm">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent">{i + 1}</span>
                  <div>
                    <p>{mandatoryText(r)}</p>
                    <p className="text-xs text-muted">
                      {r.id} · {r.type.replace(/_/g, " ")}
                    </p>
                  </div>
                </li>
              ))}
              {rules.mandatory.length === 0 ? <li className="text-sm text-muted">None defined.</li> : null}
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="size-5 text-accent" /> Preferences
            </CardTitle>
            <CardDescription>Used to rank eligible products. Higher weight counts more.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {rules.preferences.map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-3 text-sm">
                  <div>
                    <p>{preferenceText(r)}</p>
                    <p className="text-xs text-muted">
                      {r.id} · {r.type.replace(/_/g, " ")}
                    </p>
                  </div>
                  <Badge variant="outline">weight {r.weight}</Badge>
                </li>
              ))}
              {rules.preferences.length === 0 ? <li className="text-sm text-muted">None defined.</li> : null}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="size-5 text-accent" /> How quantities and costs are calculated
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <strong>Ordered amount</strong> = ordered quantity × package size of the unavailable product (units are converted: kg→g, l→ml).
          </p>
          <p>
            <strong>Replacement quantity</strong> = ordered amount ÷ substitute package size, rounded {rules.quantity.rounding === "up" ? "up to a whole package" : rules.quantity.rounding === "down" ? "down to a whole package" : "to the nearest whole package"} (minimum 1).
            {rules.quantity.note ? ` ${rules.quantity.note}` : ""}
          </p>
          <p>
            <strong>Cost difference</strong> = replacement quantity × substitute price − ordered quantity × original price. All figures are computed by the application from the imported dataset; the AI never produces numbers.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
