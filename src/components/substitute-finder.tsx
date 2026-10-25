"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, RefreshCw, Search, Sparkles, XCircle, Ban, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { SubstitutionResult, EligibleCandidate, Recommendation, RejectedCandidate, EngineProduct } from "@/lib/substitution/types";
import { formatEur, formatPackage, formatSignedEur, formatAmount } from "@/lib/substitution/units";
import { cn, nowMs } from "@/lib/utils";

interface ProductLite {
  code: string;
  name: string;
  category: string;
  packageQuantity: number;
  packageUnit: string;
  price: number;
  available: boolean;
  attributes: Record<string, unknown>;
}

interface Catalogue {
  dataset: { id: string; name: string; version: number; isSample: boolean };
  ruleSet: { id: string; name: string; version: number };
  aiConfigured: boolean;
  products: ProductLite[];
}

type Result = SubstitutionResult & { datasetId: string; ruleSetId: string };

type Outcome = "ACCEPTED_RECOMMENDATION" | "MANUAL_SELECTION" | "NO_SUBSTITUTE";

interface Decision {
  outcome: Outcome;
  product?: EngineProduct;
  quantity?: number;
  rank?: number;
  originalCost: number;
  substituteCost: number | null;
  costDifference: number | null;
}

async function readError(res: Response): Promise<string> {
  try {
    const j = await res.json();
    return j.error ?? `Request failed (${res.status}).`;
  } catch {
    return `Request failed (${res.status}).`;
  }
}

export function SubstituteFinder() {
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pickerName, setPickerName] = useState("");
  const [query, setQuery] = useState("");
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [quantity, setQuantity] = useState("1");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const shownAt = useRef<number>(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem("sa.pickerName");
    } catch {}
    fetch("/api/products")
      .then(async (r) => {
        if (!r.ok) throw new Error(await readError(r));
        return (await r.json()) as Catalogue;
      })
      .then(setCatalogue)
      .catch((e: Error) => setLoadError(e.message))
      .finally(() => {
        if (stored) setPickerName(stored);
      });
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("sa.pickerName", pickerName);
    } catch {}
  }, [pickerName]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (listRef.current && !listRef.current.contains(e.target as Node)) setListOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filtered = useMemo(() => {
    if (!catalogue) return [];
    const q = query.trim().toLowerCase();
    const list = q
      ? catalogue.products.filter((p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
      : catalogue.products;
    return list.slice(0, 40);
  }, [catalogue, query]);

  const selected = catalogue?.products.find((p) => p.code === selectedCode) ?? null;

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    if (!selected) {
      setSearchError("Select the product the customer ordered.");
      return;
    }
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setSearchError("Enter a positive quantity.");
      return;
    }
    setSearchError(null);
    setSearching(true);
    setResult(null);
    setDecision(null);
    setSaveError(null);
    try {
      const res = await fetch("/api/substitutes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productCode: selected.code, quantity: qty }) });
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as Result;
      setResult(data);
      shownAt.current = nowMs();
    } catch (err) {
      setSearchError((err as Error).message);
    } finally {
      setSearching(false);
    }
  }

  async function record(outcome: Outcome, candidate?: EligibleCandidate | Recommendation, quantityOverride?: number, rank?: number) {
    if (!result) return;
    setSaving(true);
    setSaveError(null);
    const qty = candidate ? (quantityOverride ?? candidate.replacementQuantity) : undefined;
    try {
      const res = await fetch("/api/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datasetId: result.datasetId,
          ruleSetId: result.ruleSetId,
          pickerName: pickerName || undefined,
          originalProductCode: result.original.code,
          orderedQuantity: result.orderedQuantity,
          outcome,
          selectedProductCode: candidate?.product.code,
          selectedQuantity: qty,
          recommendationRank: rank,
          recommendations: result.recommendations.map((r) => ({ rank: r.rank, code: r.product.code, replacementQuantity: r.replacementQuantity, costDifference: r.costDifference, explanation: r.explanation })),
          recommendationSource: result.source,
          durationMs: Math.max(0, nowMs() - shownAt.current),
        }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const saved = (await res.json()) as { originalCost: number; substituteCost: number | null; costDifference: number | null };
      setDecision({ outcome, product: candidate?.product, quantity: qty, rank, ...saved });
      setManualOpen(false);
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setResult(null);
    setDecision(null);
    setSelectedCode(null);
    setQuery("");
    setQuantity("1");
    setSearchError(null);
    setSaveError(null);
  }

  if (loadError) {
    return (
      <Alert variant="error" title="The product catalogue could not be loaded">
        {loadError}
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {catalogue?.dataset.isSample ? (
        <Alert variant="warning" title="Sample dataset in use">
          The active dataset is the built-in sample with fictional prices. Decisions made with it are flagged as mock data and excluded from exports. Import the real product file in the researcher dashboard.
        </Alert>
      ) : null}
      {catalogue && !catalogue.aiConfigured ? (
        <Alert variant="info" title="AI ranking not configured">
          No Anthropic API key is set on the server, so recommendations are ordered by the rule-based preference score only.
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Unavailable product</CardTitle>
          <CardDescription>
            {catalogue ? `Dataset v${catalogue.dataset.version} · ${catalogue.products.length} products · rules v${catalogue.ruleSet.version}` : "Loading catalogue…"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={search} className="grid gap-4 md:grid-cols-[1fr_140px_200px] md:items-end">
            <div className="relative" ref={listRef}>
              <Label htmlFor="product">Ordered product</Label>
              <div className="relative mt-1.5">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                <Input
                  id="product"
                  autoComplete="off"
                  placeholder={catalogue ? "Search by name, code or category…" : "Loading…"}
                  disabled={!catalogue}
                  value={selected && !listOpen ? `${selected.name} (${formatPackage(selected.packageQuantity, selected.packageUnit)})` : query}
                  onFocus={() => setListOpen(true)}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSelectedCode(null);
                    setListOpen(true);
                  }}
                  className="pl-9 pr-9"
                  role="combobox"
                  aria-expanded={listOpen}
                  aria-controls="product-list"
                />
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              </div>
              {listOpen && catalogue ? (
                <div id="product-list" role="listbox" className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-border bg-white shadow-lg">
                  {filtered.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-muted">No products match.</p>
                  ) : (
                    filtered.map((p) => (
                      <button
                        key={p.code}
                        type="button"
                        role="option"
                        aria-selected={p.code === selectedCode}
                        onClick={() => {
                          setSelectedCode(p.code);
                          setQuery("");
                          setListOpen(false);
                        }}
                        className={cn("flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-zinc-50", p.code === selectedCode && "bg-accent-soft")}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{p.name}</span>
                          <span className="block text-xs text-muted">
                            {p.code} · {p.category} · {formatPackage(p.packageQuantity, p.packageUnit)}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          {!p.available ? <Badge variant="danger">Out of stock</Badge> : null}
                          <span className="text-sm tabular-nums">{formatEur(p.price)}</span>
                        </span>
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </div>
            <div>
              <Label htmlFor="quantity">Ordered quantity</Label>
              <Input id="quantity" type="number" min={1} max={1000} step={1} inputMode="numeric" className="mt-1.5" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <Button type="submit" size="lg" disabled={searching || !catalogue} className="md:h-10">
              {searching ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {searching ? "Finding substitutes…" : "Find substitutes"}
            </Button>
          </form>
          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr]">
            <div>
              <Label htmlFor="picker">Your name or picker ID (optional)</Label>
              <Input id="picker" className="mt-1.5" placeholder="e.g. picker-07" value={pickerName} onChange={(e) => setPickerName(e.target.value)} maxLength={80} />
            </div>
            {selected ? (
              <div className="rounded-lg border border-border bg-zinc-50 p-3 text-sm">
                <p className="font-medium">{selected.name}</p>
                <p className="text-muted">
                  {selected.category} · {formatPackage(selected.packageQuantity, selected.packageUnit)} · {formatEur(selected.price)} per package
                  {selected.attributes && Object.keys(selected.attributes).length ? ` · ${attributeSummary(selected.attributes)}` : ""}
                </p>
              </div>
            ) : null}
          </div>
          {searchError ? (
            <Alert variant="error" className="mt-4">
              {searchError}
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      {result && !decision ? (
        <section className="space-y-4" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">
                Recommendations for {result.original.name} × {result.orderedQuantity}
              </h2>
              <p className="text-sm text-muted">
                Ordered amount {formatAmount(result.eligible[0]?.originalTotalAmount ?? result.original.packageQuantity * result.orderedQuantity, result.eligible[0]?.amountUnit ?? result.original.packageUnit)} ·
                order line {formatEur(result.originalCost)} · {result.source === "ai" ? "ranked by AI" : "rule-based ranking"} ·{" "}
                {result.eligible.length} of {result.eligible.length + result.rejected.length} alternatives passed the mandatory rules
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setManualOpen(true)}>
                <Search /> Search manually
              </Button>
              <Button variant="outline" onClick={() => record("NO_SUBSTITUTE")} disabled={saving}>
                <Ban /> No suitable substitute
              </Button>
            </div>
          </div>

          {result.source !== "ai" ? <Alert variant="info">{result.sourceNote}</Alert> : null}

          {result.recommendations.length === 0 ? (
            <Alert variant="warning" title="No alternative passed the mandatory rules">
              Open “Search manually” to see why each product was rejected, or choose “No suitable substitute”.
            </Alert>
          ) : (
            <div className="grid gap-4 lg:grid-cols-3">
              {result.recommendations.map((r) => (
                <RecommendationCard key={r.product.code} r={r} onAccept={(qty) => record("ACCEPTED_RECOMMENDATION", r, qty, r.rank)} saving={saving} />
              ))}
            </div>
          )}

          {saveError ? <Alert variant="error">{saveError}</Alert> : null}
        </section>
      ) : null}

      {decision && result ? (
        <Card className="border-emerald-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Check className="size-5 text-emerald-600" /> Decision recorded
            </CardTitle>
            <CardDescription>This prototype only logs the decision; the real order is not modified.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              <span className="text-muted">Unavailable:</span> {result.original.name} × {result.orderedQuantity} ({formatEur(decision.originalCost)})
            </p>
            {decision.outcome === "NO_SUBSTITUTE" ? (
              <p className="font-medium">No suitable substitute – the customer will be informed by the standard process.</p>
            ) : (
              <p>
                <span className="text-muted">{decision.outcome === "ACCEPTED_RECOMMENDATION" ? `Accepted recommendation #${decision.rank}:` : "Manual selection:"}</span>{" "}
                <span className="font-medium">
                  {decision.product?.name} × {decision.quantity}
                </span>{" "}
                ({formatEur(decision.substituteCost ?? 0)}, {formatSignedEur(decision.costDifference ?? 0)} vs original)
              </p>
            )}
            <Button onClick={reset}>
              <RefreshCw /> New search
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {result ? (
        <Dialog open={manualOpen} onOpenChange={setManualOpen}>
          <DialogContent title="Search manually" description={`All ${result.original.category} products in the dataset. Products that fail a mandatory rule cannot be selected.`}>
            <ManualList result={result} onSelect={(c, qty) => record("MANUAL_SELECTION", c, qty)} saving={saving} error={saveError} />
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

function attributeSummary(attrs: Record<string, unknown>): string {
  return Object.entries(attrs)
    .filter(([, v]) => v !== false && v !== null && v !== "" && v !== undefined)
    .map(([k, v]) => (v === true ? k.replace(/_/g, "-") : `${k.replace(/_/g, " ")}: ${String(v)}`))
    .join(", ");
}

function RecommendationCard({ r, onAccept, saving }: { r: Recommendation; onAccept: (qty: number) => void; saving: boolean }) {
  const [qty, setQty] = useState(String(r.replacementQuantity));
  const q = Number(qty);
  const total = Number.isFinite(q) && q > 0 ? r.product.price * q : NaN;
  const diff = Number.isFinite(total) ? total - r.originalCost : NaN;
  const changed = q !== r.replacementQuantity;
  return (
    <Card className={cn("flex flex-col", r.rank === 1 && "border-accent/60 ring-1 ring-accent/20")}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <Badge variant={r.rank === 1 ? "default" : "secondary"}>#{r.rank}</Badge>
          <span className={cn("text-sm font-semibold tabular-nums", r.costDifference > 0 ? "text-amber-700" : r.costDifference < 0 ? "text-emerald-700" : "text-muted")}>
            {formatSignedEur(r.costDifference)}
          </span>
        </div>
        <CardTitle className="leading-snug">{r.product.name}</CardTitle>
        <CardDescription>
          {r.product.code} · {formatPackage(r.product.packageQuantity, r.product.packageUnit)} · {formatEur(r.product.price)} per package
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3 text-sm">
        <p className="rounded-lg bg-zinc-50 p-3 leading-relaxed">{r.explanation}</p>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          <dt className="text-muted">Replacement qty</dt>
          <dd className="tabular-nums">
            {r.replacementQuantity} × {formatPackage(r.product.packageQuantity, r.product.packageUnit)}
            {Number.isFinite(r.replacementTotalAmount) ? ` = ${formatAmount(r.replacementTotalAmount, r.amountUnit)}` : ""}
          </dd>
          <dt className="text-muted">Amount vs ordered</dt>
          <dd className="tabular-nums">{Number.isFinite(r.quantityDeviationPercent) ? `${r.quantityDeviationPercent > 0 ? "+" : ""}${r.quantityDeviationPercent.toFixed(0)} %` : "n/a"}</dd>
          <dt className="text-muted">Substitute total</dt>
          <dd className="tabular-nums">{formatEur(r.substituteCost)}</dd>
          <dt className="text-muted">Original total</dt>
          <dd className="tabular-nums">{formatEur(r.originalCost)}</dd>
          {r.product.attributes && Object.keys(r.product.attributes).length ? (
            <>
              <dt className="text-muted">Attributes</dt>
              <dd>{attributeSummary(r.product.attributes)}</dd>
            </>
          ) : null}
          {r.product.ingredients ? (
            <>
              <dt className="text-muted">Ingredients</dt>
              <dd className="line-clamp-2" title={r.product.ingredients}>
                {r.product.ingredients}
              </dd>
            </>
          ) : null}
        </dl>
        <div className="mt-auto flex items-end gap-2 pt-1">
          <div className="w-24">
            <Label htmlFor={`qty-${r.product.code}`} className="text-xs text-muted">
              Quantity
            </Label>
            <Input id={`qty-${r.product.code}`} type="number" min={1} max={1000} step={1} className="mt-1 h-9" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <Button className="flex-1" onClick={() => onAccept(q)} disabled={saving || !Number.isFinite(q) || q <= 0}>
            <Check /> Accept
          </Button>
        </div>
        {changed && Number.isFinite(total) ? (
          <p className="text-xs text-muted">
            With {q} packages: {formatEur(total)} ({formatSignedEur(diff)}).
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ManualList({ result, onSelect, saving, error }: { result: Result; onSelect: (c: EligibleCandidate, qty: number) => void; saving: boolean; error: string | null }) {
  const [q, setQ] = useState("");
  const [chosen, setChosen] = useState<string | null>(null);
  const [qty, setQty] = useState("");
  const ql = q.trim().toLowerCase();
  const match = (p: EngineProduct) => !ql || p.name.toLowerCase().includes(ql) || p.code.toLowerCase().includes(ql);
  const eligible = result.eligible.filter((e) => match(e.product));
  const rejected = result.rejected.filter((r) => match(r.product));
  const chosenCandidate = result.eligible.find((e) => e.product.code === chosen) ?? null;

  return (
    <div className="space-y-4">
      <Input placeholder="Filter by name or code…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Eligible ({eligible.length})</p>
        {eligible.length === 0 ? <p className="text-sm text-muted">No eligible product matches.</p> : null}
        <div className="divide-y divide-border rounded-lg border border-border">
          {eligible.map((e) => (
            <label key={e.product.code} className={cn("flex cursor-pointer items-start gap-3 p-3 text-sm hover:bg-zinc-50", chosen === e.product.code && "bg-accent-soft")}>
              <input
                type="radio"
                name="manual"
                className="mt-1 accent-accent"
                checked={chosen === e.product.code}
                onChange={() => {
                  setChosen(e.product.code);
                  setQty(String(e.replacementQuantity));
                }}
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{e.product.name}</span>
                  <span className={cn("text-xs tabular-nums", e.costDifference > 0 ? "text-amber-700" : "text-emerald-700")}>{formatSignedEur(e.costDifference)}</span>
                </span>
                <span className="block text-xs text-muted">
                  {e.product.code} · {formatPackage(e.product.packageQuantity, e.product.packageUnit)} · {formatEur(e.product.price)} · suggested {e.replacementQuantity} pcs = {formatEur(e.substituteCost)}
                  {e.product.attributes && Object.keys(e.product.attributes).length ? ` · ${attributeSummary(e.product.attributes)}` : ""}
                </span>
              </span>
            </label>
          ))}
        </div>
      </div>
      {rejected.length > 0 ? (
        <Accordion type="single" collapsible className="rounded-lg border border-border px-3">
          <AccordionItem value="rejected">
            <AccordionTrigger>Rejected by mandatory rules ({rejected.length})</AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-2">
                {rejected.map((r: RejectedCandidate) => (
                  <li key={r.product.code} className="rounded-lg bg-zinc-50 p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-zinc-700">{r.product.name}</span>
                      <span className="text-xs text-muted">
                        {formatPackage(r.product.packageQuantity, r.product.packageUnit)} · {formatEur(r.product.price)}
                      </span>
                    </div>
                    <ul className="mt-1 space-y-0.5 text-xs">
                      {r.checks
                        .filter((c) => !c.passed)
                        .map((c) => (
                          <li key={c.ruleId} className="flex items-start gap-1.5 text-accent">
                            <XCircle className="mt-0.5 size-3.5 shrink-0" /> {c.detail}
                          </li>
                        ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ) : null}
      {error ? <Alert variant="error">{error}</Alert> : null}
      <div className="flex items-end justify-end gap-2 border-t border-border pt-4">
        <div className="w-28">
          <Label htmlFor="manual-qty" className="text-xs text-muted">
            Quantity
          </Label>
          <Input id="manual-qty" type="number" min={1} max={1000} step={1} className="mt-1 h-9" value={qty} onChange={(e) => setQty(e.target.value)} disabled={!chosenCandidate} />
        </div>
        <Button disabled={!chosenCandidate || saving || !(Number(qty) > 0)} onClick={() => chosenCandidate && onSelect(chosenCandidate, Number(qty))}>
          {saving ? <Loader2 className="animate-spin" /> : <Check />} Use this product
        </Button>
      </div>
    </div>
  );
}
