import { SubstituteFinder } from "@/components/substitute-finder";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Find a substitute</h1>
        <p className="mt-1 text-sm text-muted">
          Select the product the customer ordered and the ordered quantity. The assistant applies the company&apos;s mandatory rules first and then ranks
          the eligible alternatives. Nothing here changes a real order.
        </p>
      </div>
      <SubstituteFinder />
    </div>
  );
}
