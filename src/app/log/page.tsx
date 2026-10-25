import Link from "next/link";
import { Download } from "lucide-react";
import { prisma, isDatabaseError } from "@/lib/prisma";
import { isResearcher } from "@/lib/auth";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { formatEur, formatSignedEur } from "@/lib/substitution/units";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DecisionRowActions } from "@/components/decision-row-actions";

export const dynamic = "force-dynamic";

const OUTCOME_LABEL = {
  ACCEPTED_RECOMMENDATION: { label: "Accepted recommendation", variant: "success" as const },
  MANUAL_SELECTION: { label: "Manual selection", variant: "secondary" as const },
  NO_SUBSTITUTE: { label: "No substitute", variant: "warning" as const },
};

export default async function LogPage() {
  const researcher = await isResearcher();
  let rows: Awaited<ReturnType<typeof prisma.substitutionDecision.findMany>> = [];
  let error: string | null = null;
  try {
    rows = await prisma.substitutionDecision.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  } catch (err) {
    error = isDatabaseError(err) ? "The database is not reachable right now. Please try again in a moment." : "Could not load the decision log.";
  }

  const real = rows.filter((r) => !r.isMock);
  const stats = summarize(real);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Decision log</h1>
          <p className="mt-1 text-sm text-muted">Every substitution decision made with the tool, with the costs calculated at the time. Mock decisions are excluded from the summary and the export.</p>
        </div>
        {researcher ? (
          <Button asChild variant="secondary">
            <a href="/api/decisions/export">
              <Download /> Export CSV
            </a>
          </Button>
        ) : (
          <p className="text-xs text-muted">
            <Link href="/researcher" className="underline">
              Log in as researcher
            </Link>{" "}
            to export CSV.
          </p>
        )}
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}

      {!error ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Decisions (real)" value={String(stats.count)} />
          <Stat label="Accepted recommendation" value={stats.count ? `${Math.round((stats.accepted / stats.count) * 100)} %` : "–"} />
          <Stat label="No substitute" value={stats.count ? `${Math.round((stats.none / stats.count) * 100)} %` : "–"} />
          <Stat label="Mean cost difference" value={stats.withCost ? formatSignedEur(stats.costSum / stats.withCost) : "–"} />
        </div>
      ) : null}

      {!error ? (
        <Table>
          <THead>
            <tr>
              <th>Time</th>
              <th>Picker</th>
              <th>Unavailable product</th>
              <th>Outcome</th>
              <th>Substitute</th>
              <th className="text-right">Original</th>
              <th className="text-right">Substitute</th>
              <th className="text-right">Difference</th>
              <th>Source</th>
              {researcher ? <th></th> : null}
            </tr>
          </THead>
          <TBody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={researcher ? 10 : 9} className="py-6 text-center text-muted">
                  No decisions recorded yet.
                </td>
              </tr>
            ) : null}
            {rows.map((r) => {
              const o = OUTCOME_LABEL[r.outcome];
              return (
                <tr key={r.id} className={r.isMock ? "text-muted" : undefined}>
                  <td className="whitespace-nowrap tabular-nums">{r.createdAt.toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</td>
                  <td>{r.pickerName ?? "–"}</td>
                  <td>
                    {r.originalProductName} × {Number(r.orderedQuantity)}
                    <span className="block text-xs text-muted">{r.originalProductCode}</span>
                  </td>
                  <td>
                    <span className="flex flex-wrap gap-1">
                      <Badge variant={o.variant}>{o.label}</Badge>
                      {r.recommendationRank ? <Badge variant="outline">#{r.recommendationRank}</Badge> : null}
                      {r.isMock ? <Badge variant="danger">mock</Badge> : null}
                    </span>
                  </td>
                  <td>
                    {r.selectedProductName ? (
                      <>
                        {r.selectedProductName} × {Number(r.selectedQuantity)}
                        <span className="block text-xs text-muted">{r.selectedProductCode}</span>
                      </>
                    ) : (
                      "–"
                    )}
                  </td>
                  <td className="text-right tabular-nums">{formatEur(Number(r.originalCost))}</td>
                  <td className="text-right tabular-nums">{r.substituteCost !== null ? formatEur(Number(r.substituteCost)) : "–"}</td>
                  <td className="text-right tabular-nums">{r.costDifference !== null ? formatSignedEur(Number(r.costDifference)) : "–"}</td>
                  <td className="text-xs">{r.recommendationSource ?? "–"}</td>
                  {researcher ? (
                    <td>
                      <DecisionRowActions id={r.id} isMock={r.isMock} />
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </TBody>
        </Table>
      ) : null}
    </div>
  );
}

function summarize(rows: { outcome: string; costDifference: unknown }[]) {
  let accepted = 0;
  let none = 0;
  let costSum = 0;
  let withCost = 0;
  for (const r of rows) {
    if (r.outcome === "ACCEPTED_RECOMMENDATION") accepted++;
    if (r.outcome === "NO_SUBSTITUTE") none++;
    if (r.costDifference !== null && r.costDifference !== undefined) {
      costSum += Number(r.costDifference);
      withCost++;
    }
  }
  return { count: rows.length, accepted, none, costSum, withCost };
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
