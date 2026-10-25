import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { errorResponse, unauthorized } from "@/lib/api";
import { isResearcher } from "@/lib/auth";

export const dynamic = "force-dynamic";

const schema = z.object({ id: z.string().min(1), isMock: z.boolean() });

/** Mark a decision as mock/test data (excluded from exports) or back as real. */
export async function PATCH(req: Request) {
  try {
    if (!(await isResearcher())) return unauthorized();
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    await prisma.substitutionDecision.update({ where: { id: parsed.data.id }, data: { isMock: parsed.data.isMock } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(req: Request) {
  try {
    if (!(await isResearcher())) return unauthorized();
    const { id } = (await req.json().catch(() => ({}))) as { id?: string };
    if (!id) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    await prisma.substitutionDecision.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
