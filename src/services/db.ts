import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  (() => {
    const { createClient } = require("@libsql/client");
    const dbUrl = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || "file:./dev.db";
    const authToken = process.env.TURSO_AUTH_TOKEN;

    const config: any = { url: dbUrl };
    if (authToken) {
      config.authToken = authToken;
    }

    const libsql = createClient(config);
    const adapter = new PrismaLibSql(libsql);
    
    return new PrismaClient({ adapter });
  })();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
