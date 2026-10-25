import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { errorResponse, unauthorized } from "@/lib/api";
import { isResearcher } from "@/lib/auth";

export const dynamic = "force-dynamic";

const schema = z.object({ kind: z.enum(["dataset", "ruleSet"]), id: z.string().min(1) });

export async function POST(req: Request) {
  try {
    if (!(await isResearcher())) return unauthorized();
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    const { kind, id } = parsed.data;
    if (kind === "dataset") {
      await prisma.$transaction([prisma.dataset.updateMany({ data: { isActive: false } }), prisma.dataset.update({ where: { id }, data: { isActive: true } })]);
    } else {
      await prisma.$transaction([prisma.ruleSet.updateMany({ data: { isActive: false } }), prisma.ruleSet.update({ where: { id }, data: { isActive: true } })]);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
