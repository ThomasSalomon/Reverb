import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  (() => {
    const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || "file:./dev.db";
    const authToken = process.env.TURSO_AUTH_TOKEN;

    const config: { url: string; authToken?: string } = { url };
    if (authToken) {
      config.authToken = authToken;
    }

    const adapter = new PrismaLibSql(config);
    return new PrismaClient({ adapter });
  })();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

