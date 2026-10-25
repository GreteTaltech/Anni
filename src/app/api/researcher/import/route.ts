import { NextResponse } from "next/server";
import { errorResponse, unauthorized } from "@/lib/api";
import { isResearcher } from "@/lib/auth";
import { importDataset, importRuleSet } from "@/lib/import";

export const dynamic = "force-dynamic";

/** multipart/form-data: kind=products|rules, file, name?, activate? */
export async function POST(req: Request) {
  try {
    if (!(await isResearcher())) return unauthorized();
    const form = await req.formData();
    const kind = String(form.get("kind") ?? "");
    const file = form.get("file");
    const name = String(form.get("name") ?? "").trim();
    const activate = String(form.get("activate") ?? "true") !== "false";
    if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Choose a file to import." }, { status: 400 });
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "File is larger than 10 MB." }, { status: 400 });
    const text = await file.text();

    if (kind === "products") {
      const ds = await importDataset(text, name || file.name.replace(/\.csv$/i, ""), { activate });
      return NextResponse.json({ ok: true, message: `Imported dataset v${ds.version} "${ds.name}" with ${ds._count.products} products${activate ? " and set it active" : ""}.` });
    }
    if (kind === "rules") {
      const rs = await importRuleSet(text, name || undefined, { activate });
      return NextResponse.json({ ok: true, message: `Imported rule set v${rs.version} "${rs.name}"${activate ? " and set it active" : ""}.` });
    }
    return NextResponse.json({ error: "Unknown import kind." }, { status: 400 });
  } catch (err) {
    return errorResponse(err);
  }
}
