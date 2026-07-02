import "dotenv/config";
import { PrismaClient } from "@prisma/client";
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

    // Default native Prisma SQLite client for local development (no adapter needed)
    if (!process.env.DATABASE_URL) {
      process.env.DATABASE_URL = "file:./dev.db";
    }
    return new PrismaClient();
  })();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
