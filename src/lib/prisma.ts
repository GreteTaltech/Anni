import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/** True when the error looks like the database is unreachable or not migrated. */
export function isDatabaseError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; name?: string; message?: string };
  if (e.name === "PrismaClientInitializationError") return true;
  if (e.name === "PrismaClientKnownRequestError" && e.code && /^P(1\d{3}|2021|2022)$/.test(e.code)) return true;
  return /ECONNREFUSED|ENOTFOUND|Can't reach database|DATABASE_URL/i.test(e.message ?? "");
}
