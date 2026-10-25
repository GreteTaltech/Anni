import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseCsv } from "@/lib/csv";
import { ruleSetSchema } from "@/lib/substitution/types";

export class ImportError extends Error {}

const REQUIRED = ["code", "name", "category", "package_quantity", "package_unit", "price"];

export function parseProductsCsv(text: string): Prisma.ProductCreateManyDatasetInput[] {
  const rows = parseCsv(text);
  if (rows.length === 0) throw new ImportError("The CSV file contains no data rows.");
  const missing = REQUIRED.filter((c) => !(c in rows[0]));
  if (missing.length) throw new ImportError(`Missing required columns: ${missing.join(", ")}. Expected: ${REQUIRED.join(", ")} (+ optional ingredients, attributes, source_url, collected_at, available).`);

  const seen = new Set<string>();
  return rows.map((r, i) => {
    const line = i + 2;
    const code = r.code;
    if (!code) throw new ImportError(`Line ${line}: empty product code.`);
    if (seen.has(code)) throw new ImportError(`Line ${line}: duplicate product code ${code}.`);
    seen.add(code);
    const packageQuantity = Number(r.package_quantity.replace(",", "."));
    const price = Number(r.price.replace(",", "."));
    if (!Number.isFinite(packageQuantity) || packageQuantity <= 0) throw new ImportError(`Line ${line}: invalid package_quantity "${r.package_quantity}".`);
    if (!Number.isFinite(price) || price < 0) throw new ImportError(`Line ${line}: invalid price "${r.price}".`);
    if (!r.name) throw new ImportError(`Line ${line}: empty name.`);
    if (!r.category) throw new ImportError(`Line ${line}: empty category.`);
    if (!r.package_unit) throw new ImportError(`Line ${line}: empty package_unit.`);

    let attributes: Prisma.InputJsonValue = {};
    if (r.attributes) {
      try {
        const parsed = JSON.parse(r.attributes);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
        attributes = parsed;
      } catch {
        throw new ImportError(`Line ${line}: attributes must be a JSON object, got "${r.attributes}".`);
      }
    }
    let collectedAt: Date | null = null;
    if (r.collected_at) {
      const d = new Date(r.collected_at);
      if (Number.isNaN(d.getTime())) throw new ImportError(`Line ${line}: invalid collected_at "${r.collected_at}".`);
      collectedAt = d;
    }
    const availableRaw = (r.available ?? "").toLowerCase();
    const available = availableRaw === "" ? true : ["true", "1", "yes", "y"].includes(availableRaw);

    return {
      code,
      name: r.name,
      category: r.category,
      packageQuantity: new Prisma.Decimal(packageQuantity),
      packageUnit: r.package_unit,
      price: new Prisma.Decimal(price),
      ingredients: r.ingredients || null,
      attributes,
      available,
      sourceUrl: r.source_url || null,
      collectedAt,
    };
  });
}

export async function importDataset(text: string, name: string, opts: { isSample?: boolean; activate?: boolean } = {}) {
  const products = parseProductsCsv(text);
  return prisma.$transaction(async (tx) => {
    const last = await tx.dataset.findFirst({ orderBy: { version: "desc" } });
    const version = (last?.version ?? 0) + 1;
    if (opts.activate !== false) await tx.dataset.updateMany({ data: { isActive: false } });
    return tx.dataset.create({
      data: {
        version,
        name,
        isSample: opts.isSample ?? false,
        isActive: opts.activate !== false,
        products: { createMany: { data: products } },
      },
      include: { _count: { select: { products: true } } },
    });
  });
}

export async function importRuleSet(text: string, name?: string, opts: { activate?: boolean } = {}) {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new ImportError("The rules file is not valid JSON.");
  }
  const parsed = ruleSetSchema.safeParse(json);
  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
    throw new ImportError(`Rules file does not match the expected format: ${issues.join("; ")}`);
  }
  return prisma.$transaction(async (tx) => {
    const last = await tx.ruleSet.findFirst({ orderBy: { version: "desc" } });
    const version = (last?.version ?? 0) + 1;
    if (opts.activate !== false) await tx.ruleSet.updateMany({ data: { isActive: false } });
    return tx.ruleSet.create({
      data: { version, name: name || parsed.data.name, rules: parsed.data as unknown as Prisma.InputJsonValue, isActive: opts.activate !== false },
    });
  });
}
