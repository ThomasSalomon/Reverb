import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  (() => {
    if (process.env.TURSO_DATABASE_URL) {
      const adapter = new PrismaLibSql({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN,
      });
      return new PrismaClient({ adapter });
    }

    // Falls back to root dev.db if DATABASE_URL is not set
    const databaseUrl = process.env.DATABASE_URL || "file:./dev.db";
    const adapter = new PrismaBetterSqlite3({
      url: databaseUrl,
    });
    return new PrismaClient({ adapter });
  })();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
