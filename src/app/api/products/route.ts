import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/api";
import { getActiveConfiguration } from "@/lib/substitution";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { dataset, ruleSet } = await getActiveConfiguration();
    const products = await prisma.product.findMany({
      where: { datasetId: dataset.id },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: { code: true, name: true, category: true, packageQuantity: true, packageUnit: true, price: true, available: true, attributes: true },
    });
    return NextResponse.json({
      dataset: { id: dataset.id, name: dataset.name, version: dataset.version, isSample: dataset.isSample },
      ruleSet: { id: ruleSet.id, name: ruleSet.name, version: ruleSet.version },
      aiConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
      products: products.map((p) => ({
        ...p,
        packageQuantity: Number(p.packageQuantity),
        price: Number(p.price),
      })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
