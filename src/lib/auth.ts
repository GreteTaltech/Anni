import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "researcher_session";
const MAX_AGE_SECONDS = 60 * 60 * 12;

function secret(): string | null {
  const s = process.env.AUTH_SECRET || process.env.RESEARCHER_PASSWORD;
  return s && s.length > 0 ? s : null;
}

function sign(payload: string): string {
  return createHmac("sha256", secret() ?? "").update(payload).digest("hex");
}

export function isResearcherConfigured(): boolean {
  return Boolean(process.env.RESEARCHER_PASSWORD);
}

export function verifyPassword(input: string): boolean {
  const expected = process.env.RESEARCHER_PASSWORD;
  if (!expected) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createSessionToken(): string {
  const expires = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = `researcher.${expires}`;
  return `${payload}.${sign(payload)}`;
}

export function validateSessionToken(token: string | undefined): boolean {
  if (!token || !secret()) return false;
  const idx = token.lastIndexOf(".");
  if (idx < 0) return false;
  const payload = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = sign(payload);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  const expires = Number(payload.split(".")[1]);
  return Number.isFinite(expires) && expires > Date.now();
}

export async function isResearcher(): Promise<boolean> {
  const store = await cookies();
  return validateSessionToken(store.get(SESSION_COOKIE)?.value);
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE_SECONDS,
};
