import { PrismaClient } from "@prisma/client";

/**
 * Prisma client singleton.
 * Persisted on globalThis across hot-reloads in dev and warm containers in serverless production
 * to prevent exhausting DB connections and avoid SSL connection setup overhead on every request.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

globalForPrisma.prisma = prisma;
