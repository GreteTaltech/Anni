import { redirect } from "next/navigation";
import { isResearcher, isResearcherConfigured } from "@/lib/auth";
import { LoginForm } from "@/components/login-form";
import { Alert } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await isResearcher()) redirect("/researcher");
  return (
    <div className="mx-auto max-w-sm space-y-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Researcher login</h1>
        <p className="mt-1 text-sm text-muted">The dashboard lets you import product data and rules, manage versions and export the decision log.</p>
      </div>
      {!isResearcherConfigured() ? (
        <Alert variant="warning" title="Not configured">
          Set the RESEARCHER_PASSWORD environment variable on the server to enable the dashboard.
        </Alert>
      ) : (
        <LoginForm />
      )}
    </div>
  );
}
