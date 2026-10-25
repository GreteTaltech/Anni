import { NextResponse } from "next/server";
import { isDatabaseError } from "@/lib/prisma";
import { SubstitutionError } from "@/lib/substitution";
import { ImportError } from "@/lib/import";

/** Map errors to JSON responses with a friendly message. */
export function errorResponse(err: unknown): NextResponse {
  if (err instanceof SubstitutionError) return NextResponse.json({ error: err.message }, { status: err.status });
  if (err instanceof ImportError) return NextResponse.json({ error: err.message }, { status: 400 });
  if (isDatabaseError(err)) {
    console.error("Database error:", err);
    return NextResponse.json({ error: "The database is not reachable right now. Please try again in a moment or contact the researcher." }, { status: 503 });
  }
  console.error("Unexpected error:", err);
  return NextResponse.json({ error: "Something went wrong on the server. Please try again." }, { status: 500 });
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Researcher login required." }, { status: 401 });
}
