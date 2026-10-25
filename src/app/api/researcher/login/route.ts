import { NextResponse } from "next/server";
import { createSessionToken, isResearcherConfigured, SESSION_COOKIE, sessionCookieOptions, verifyPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isResearcherConfigured()) {
    return NextResponse.json({ error: "Researcher login is not configured. Set RESEARCHER_PASSWORD on the server." }, { status: 503 });
  }
  const body = (await req.json().catch(() => null)) as { password?: string } | null;
  const password = body?.password ?? "";
  if (!verifyPassword(password)) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, createSessionToken(), sessionCookieOptions);
  return res;
}
