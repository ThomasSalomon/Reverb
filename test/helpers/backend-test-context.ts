import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { createClient } from "@libsql/client";
import type { PrismaClient } from "@prisma/client";

const migrationsRoot = resolve(process.cwd(), "prisma", "migrations");
const testSecret = "backend-integration-test-secret-with-enough-entropy";

type EnvironmentSnapshot = Record<string, string | undefined>;

type UserInput = Partial<{
  id: string;
  username: string;
  email: string;
  password: string;
}>;

type MusicItemInput = Partial<{
  id: string;
  title: string;
  artist: string;
  type: "ALBUM" | "SONG";
  coverUrl: string;
  releaseYear: number;
}>;

function fileUrl(path: string): string {
  return `file:${path.replaceAll(sep, "/")}`;
}

function snapshotEnvironment(): EnvironmentSnapshot {
  return Object.fromEntries(
    ["DATABASE_URL", "TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN", "JWT_SECRET", "NODE_ENV"].map(
      (name) => [name, process.env[name]],
    ),
  );
}

function restoreEnvironment(snapshot: EnvironmentSnapshot): void {
  for (const [name, value] of Object.entries(snapshot)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

async function applyMigrations(url: string): Promise<void> {
  const client = createClient({ url });
  try {
    const names = (await readdir(migrationsRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && /^\d+_[a-z0-9_]+$/i.test(entry.name))
      .map((entry) => entry.name)
      .sort();

    for (const name of names) {
      await client.executeMultiple(await readFile(join(migrationsRoot, name, "migration.sql"), "utf8"));
    }

    const foreignKeys = await client.execute("PRAGMA foreign_key_check");
    if (foreignKeys.rows.length > 0) throw new Error("Las migraciones dejaron claves foraneas invalidas.");
  } finally {
    client.close();
  }
}

/**
 * Isolated integration database for one test file. It applies the complete
 * versioned history to a unique temporary SQLite file and never contacts Turso.
 * Production modules must be dynamically imported after this helper is created.
 */
export async function createBackendTestContext(): Promise<{
  prisma: PrismaClient;
  createUser: (input?: UserInput) => Promise<{ id: string; username: string; email: string; password: string }>;
  createMusicItem: (input?: MusicItemInput) => Promise<{ id: string }>;
  createReview: (input: { userId: string; musicItemId: string; content?: string; ratingValue?: number }) => Promise<{ id: string }>;
  createRating: (input: { userId: string; musicItemId: string; value?: number }) => Promise<{ id: string }>;
  createDiaryEvent: (input: { userId: string; musicItemId: string; listenedAt?: Date }) => Promise<{ id: string }>;
  createList: (input: { userId: string; title?: string }) => Promise<{ id: string }>;
  createNotification: (input: { userId: string; message?: string }) => Promise<{ id: string }>;
  close: () => Promise<void>;
}> {
  const directory = await mkdtemp(join(tmpdir(), "musicbox-backend-test-"));
  const databasePath = join(directory, "integration.db");
  const url = fileUrl(databasePath);
  const environment = snapshotEnvironment();
  await writeFile(databasePath, "");

  process.env.DATABASE_URL = url;
  process.env.TURSO_DATABASE_URL = url;
  delete process.env.TURSO_AUTH_TOKEN;
  process.env.JWT_SECRET = testSecret;
  (process.env as Record<string, string | undefined>).NODE_ENV = "test";

  try {
    await applyMigrations(url);
    delete (globalThis as typeof globalThis & { prisma?: PrismaClient }).prisma;
    const [{ prisma }, { hashPassword }] = await Promise.all([
      import("../../src/services/db"),
      import("../../src/utils/crypto"),
    ]);
    let sequence = 0;
    const next = () => {
      sequence += 1;
      return sequence;
    };

    return {
      prisma,
      async createUser(input = {}) {
        const index = next();
        const password = input.password ?? `valid-password-${index}`;
        const user = await prisma.user.create({
          data: {
            id: input.id ?? `test-user-${index}`,
            username: input.username ?? `user-${index}`,
            email: input.email ?? `user-${index}@example.test`,
            password: await hashPassword(password),
          },
          select: { id: true, username: true, email: true },
        });
        return { ...user, password };
      },
      async createMusicItem(input = {}) {
        const index = next();
        return prisma.musicItem.create({
          data: {
            id: input.id ?? `test-item-${index}`,
            title: input.title ?? `Album ${index}`,
            artist: input.artist ?? "Test Artist",
            type: input.type ?? "ALBUM",
            coverUrl: input.coverUrl ?? "https://example.test/cover.jpg",
            releaseYear: input.releaseYear ?? 2026,
          },
          select: { id: true },
        });
      },
      async createReview(input) {
        return prisma.review.create({
          data: {
            userId: input.userId,
            musicItemId: input.musicItemId,
            content: input.content ?? "Valid review",
            ratingValue: input.ratingValue ?? 4,
          },
          select: { id: true },
        });
      },
      async createRating(input) {
        return prisma.rating.create({
          data: { userId: input.userId, musicItemId: input.musicItemId, value: input.value ?? 4 },
          select: { id: true },
        });
      },
      async createDiaryEvent(input) {
        return prisma.diaryLog.create({
          data: { userId: input.userId, musicItemId: input.musicItemId, listenedAt: input.listenedAt },
          select: { id: true },
        });
      },
      async createList(input) {
        return prisma.list.create({
          data: { userId: input.userId, title: input.title ?? "Valid list" },
          select: { id: true },
        });
      },
      async createNotification(input) {
        return prisma.notification.create({
          data: { userId: input.userId, message: input.message ?? "Valid notification", type: "TEST" },
          select: { id: true },
        });
      },
      async close() {
        await prisma.$disconnect();
        delete (globalThis as typeof globalThis & { prisma?: PrismaClient }).prisma;
        restoreEnvironment(environment);
        await rm(directory, { recursive: true, force: true, maxRetries: 20, retryDelay: 200 });
      },
    };
  } catch (error) {
    restoreEnvironment(environment);
    await rm(directory, { recursive: true, force: true, maxRetries: 20, retryDelay: 200 });
    throw error;
  }
}
