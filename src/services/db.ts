import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  (() => {
    // Falls back to root dev.db if DATABASE_URL is not set
    const databaseUrl = process.env.DATABASE_URL || "file:./dev.db";
    const adapter = new PrismaBetterSqlite3({
      url: databaseUrl,
    });
    return new PrismaClient({ adapter });
  })();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
