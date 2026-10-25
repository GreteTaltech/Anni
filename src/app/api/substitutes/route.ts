import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/api";
import { findSubstitutes } from "@/lib/substitution";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  productCode: z.string().min(1),
  quantity: z.coerce.number().positive().max(1000),
});

export async function POST(req: Request) {
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Select a product and enter a positive quantity." }, { status: 400 });
    const result = await findSubstitutes(parsed.data.productCode, parsed.data.quantity);
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
