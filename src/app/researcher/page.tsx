import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { prisma, isDatabaseError } from "@/lib/prisma";
import { isResearcher } from "@/lib/auth";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImportForm, ActivateButton, LogoutButton } from "@/components/researcher-controls";

export const dynamic = "force-dynamic";

export default async function ResearcherPage() {
  if (!(await isResearcher())) redirect("/researcher/login");

  let error: string | null = null;
  let datasets: Awaited<ReturnType<typeof loadDatasets>> = [];
  let ruleSets: Awaited<ReturnType<typeof prisma.ruleSet.findMany>> = [];
  let decisionCounts = { real: 0, mock: 0 };
  try {
    [datasets, ruleSets] = await Promise.all([loadDatasets(), prisma.ruleSet.findMany({ orderBy: { version: "desc" } })]);
    const [real, mock] = await Promise.all([prisma.substitutionDecision.count({ where: { isMock: false } }), prisma.substitutionDecision.count({ where: { isMock: true } })]);
    decisionCounts = { real, mock };
  } catch (err) {
    error = isDatabaseError(err) ? "The database is not reachable right now. Please try again in a moment." : "Could not load the dashboard data.";
  }

  const aiConfigured = Boolean(process.env.ANTHROPIC_API_KEY);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Researcher dashboard</h1>
          <p className="mt-1 text-sm text-muted">Import data, manage versions and export results. Imports always create a new version; existing versions are never modified.</p>
        </div>
        <LogoutButton />
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted">Decisions</CardTitle>
          </CardHeader>
          <CardContent className="flex items-end justify-between gap-2">
            <p className="text-2xl font-semibold tabular-nums">
              {decisionCounts.real} <span className="text-sm font-normal text-muted">real · {decisionCounts.mock} mock</span>
            </p>
            <Button asChild variant="secondary" size="sm">
              <a href="/api/decisions/export">
                <Download /> CSV
              </a>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted">AI ranking</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              {aiConfigured ? (
                <Badge variant="success">configured · {process.env.ANTHROPIC_MODEL || "claude-opus-5-5"}</Badge>
              ) : (
                <Badge variant="warning">not configured – rule-based ranking only</Badge>
              )}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted">Active versions</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p>Dataset: {datasets.find((d) => d.isActive)?.name ?? "none"}</p>
            <p>Rules: {ruleSets.find((r) => r.isActive)?.name ?? "none"}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">Product data</TabsTrigger>
          <TabsTrigger value="rules">Substitution rules</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Import products.csv</CardTitle>
              <CardDescription>
                Columns: code, name, category, package_quantity, package_unit, price, ingredients, attributes (JSON object), source_url, collected_at, available (true/false). A new dataset version is created.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ImportForm kind="products" accept=".csv,text/csv" />
            </CardContent>
          </Card>
          <Table>
            <THead>
              <tr>
                <th>Version</th>
                <th>Name</th>
                <th>Products</th>
                <th>Imported</th>
                <th>Status</th>
                <th></th>
              </tr>
            </THead>
            <TBody>
              {datasets.map((d) => (
                <tr key={d.id}>
                  <td>v{d.version}</td>
                  <td>
                    {d.name} {d.isSample ? <Badge variant="danger">sample</Badge> : null}
                  </td>
                  <td>{d._count.products}</td>
                  <td>{d.createdAt.toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</td>
                  <td>{d.isActive ? <Badge variant="success">active</Badge> : <span className="text-muted">–</span>}</td>
                  <td className="text-right">{!d.isActive ? <ActivateButton kind="dataset" id={d.id} /> : null}</td>
                </tr>
              ))}
              {datasets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-muted">
                    No datasets yet.
                  </td>
                </tr>
              ) : null}
            </TBody>
          </Table>
        </TabsContent>

        <TabsContent value="rules" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Import substitution_rules.json</CardTitle>
              <CardDescription>
                JSON with <code>mandatory</code> (same_category, price_limit, quantity_tolerance, preserve_attributes, same_unit), <code>preferences</code> (same_attribute, attribute_equals, closest_price, closest_package),
                <code> maxRecommendations</code> and <code>quantity.rounding</code>. See data/substitution_rules.json for a template.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ImportForm kind="rules" accept=".json,application/json" />
            </CardContent>
          </Card>
          <Table>
            <THead>
              <tr>
                <th>Version</th>
                <th>Name</th>
                <th>Imported</th>
                <th>Status</th>
                <th></th>
              </tr>
            </THead>
            <TBody>
              {ruleSets.map((r) => (
                <tr key={r.id}>
                  <td>v{r.version}</td>
                  <td>{r.name}</td>
                  <td>{r.createdAt.toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</td>
                  <td>{r.isActive ? <Badge variant="success">active</Badge> : <span className="text-muted">–</span>}</td>
                  <td className="text-right">{!r.isActive ? <ActivateButton kind="ruleSet" id={r.id} /> : null}</td>
                </tr>
              ))}
              {ruleSets.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-muted">
                    No rule sets yet.
                  </td>
                </tr>
              ) : null}
            </TBody>
          </Table>
        </TabsContent>

        <TabsContent value="export">
          <Card>
            <CardHeader>
              <CardTitle>Export decisions</CardTitle>
              <CardDescription>CSV with one row per decision, including dataset and rule versions, outcome, quantities, costs and timing. Mock decisions are excluded unless requested.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button asChild>
                <a href="/api/decisions/export">
                  <Download /> Export real decisions
                </a>
              </Button>
              <Button asChild variant="secondary">
                <a href="/api/decisions/export?includeMock=1">
                  <Download /> Export including mock
                </a>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function loadDatasets() {
  return prisma.dataset.findMany({ orderBy: { version: "desc" }, include: { _count: { select: { products: true } } } });
}
