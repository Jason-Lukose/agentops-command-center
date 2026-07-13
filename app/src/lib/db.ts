import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Standard Prisma client singleton, cached on `globalThis` in dev so that
// Next.js hot-reload does not exhaust the Postgres connection pool by
// creating a new PrismaClient on every module reload.
// https://www.prisma.io/docs/guides/nextjs
//
// Prisma 7 no longer reads `DATABASE_URL` from schema.prisma at client
// construction time — a driver adapter must be passed explicitly.
// https://pris.ly/d/prisma7-client-config

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
