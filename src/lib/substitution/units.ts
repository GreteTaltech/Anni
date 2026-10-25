/** Convert a package quantity to a base amount so sizes can be compared. */
const FACTORS: Record<string, { base: string; factor: number }> = {
  g: { base: "g", factor: 1 },
  kg: { base: "g", factor: 1000 },
  mg: { base: "g", factor: 0.001 },
  ml: { base: "ml", factor: 1 },
  cl: { base: "ml", factor: 10 },
  dl: { base: "ml", factor: 100 },
  l: { base: "ml", factor: 1000 },
  pcs: { base: "pcs", factor: 1 },
  pc: { base: "pcs", factor: 1 },
  tk: { base: "pcs", factor: 1 },
};

export function toBaseAmount(quantity: number, unit: string): { amount: number; base: string } {
  const key = unit.trim().toLowerCase();
  const f = FACTORS[key];
  if (!f) return { amount: quantity, base: key };
  return { amount: quantity * f.factor, base: f.base };
}

export function formatPackage(quantity: number, unit: string): string {
  const q = Number.isInteger(quantity) ? quantity.toString() : quantity.toFixed(3).replace(/\.?0+$/, "");
  return `${q} ${unit}`;
}

export function formatAmount(amount: number, base: string): string {
  if (base === "g" && amount >= 1000) return `${trim(amount / 1000)} kg`;
  if (base === "ml" && amount >= 1000) return `${trim(amount / 1000)} l`;
  return `${trim(amount)} ${base}`;
}

function trim(n: number): string {
  return Number.isInteger(n) ? n.toString() : n.toFixed(2).replace(/\.?0+$/, "");
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function formatEur(n: number): string {
  return `${n < 0 ? "−" : ""}${Math.abs(n).toFixed(2)} €`;
}

export function formatSignedEur(n: number): string {
  if (Math.abs(n) < 0.005) return "±0.00 €";
  return `${n > 0 ? "+" : "−"}${Math.abs(n).toFixed(2)} €`;
}
