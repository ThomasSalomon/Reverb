import { createClient, type Client } from "@libsql/client";
import { performance } from "node:perf_hooks";

type Measurement = {
  name: string;
  queries: number;
  rows: number;
  responseBytes: number;
  localMs: number;
  plan: string[];
};

const USERS = 40;
const COLLECTION_SIZE = 240;
const PAGE_SIZE = 20;

function value<T>(row: Record<string, unknown>, key: string): T {
  return row[key] as T;
}

type SqlArg = string | number | null | Uint8Array;

async function execute(client: Client, sql: string, args: SqlArg[] = []) {
  return client.execute({ sql, args });
}

async function explain(client: Client, sql: string, args: SqlArg[] = []) {
  const result = await execute(client, `EXPLAIN QUERY PLAN ${sql}`, args);
  return result.rows.map((row) => String(value(row, "detail")));
}

async function timed<T>(work: () => Promise<T>) {
  const started = performance.now();
  const result = await work();
  return { result, localMs: Number((performance.now() - started).toFixed(3)) };
}

async function seed(client: Client) {
  await client.executeMultiple(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE "User" ("id" TEXT PRIMARY KEY, "username" TEXT NOT NULL UNIQUE, "profileImage" TEXT, "profileColor" TEXT);
    CREATE TABLE "MusicItem" ("id" TEXT PRIMARY KEY, "title" TEXT NOT NULL, "artist" TEXT NOT NULL, "coverUrl" TEXT NOT NULL);
    CREATE TABLE "List" ("id" TEXT PRIMARY KEY, "title" TEXT NOT NULL, "isPublic" INTEGER NOT NULL, "createdAt" TEXT NOT NULL, "userId" TEXT NOT NULL);
    CREATE TABLE "ListItem" ("id" TEXT PRIMARY KEY, "listId" TEXT NOT NULL, "musicItemId" TEXT NOT NULL, "order" INTEGER NOT NULL);
    CREATE TABLE "Review" ("id" TEXT PRIMARY KEY, "content" TEXT NOT NULL, "ratingValue" REAL NOT NULL, "createdAt" TEXT NOT NULL, "userId" TEXT NOT NULL, "musicItemId" TEXT NOT NULL);
    CREATE TABLE "Comment" ("id" TEXT PRIMARY KEY, "content" TEXT NOT NULL, "createdAt" TEXT NOT NULL, "reviewId" TEXT NOT NULL, "userId" TEXT NOT NULL);
    CREATE TABLE "Rating" ("id" TEXT PRIMARY KEY, "value" REAL NOT NULL, "userId" TEXT NOT NULL, "musicItemId" TEXT NOT NULL);
    CREATE TABLE "DiaryLog" ("id" TEXT PRIMARY KEY, "listenedAt" TEXT NOT NULL, "createdAt" TEXT NOT NULL, "userId" TEXT NOT NULL, "musicItemId" TEXT NOT NULL);
    CREATE TABLE "ListenLater" ("id" TEXT PRIMARY KEY, "createdAt" TEXT NOT NULL, "userId" TEXT NOT NULL, "musicItemId" TEXT NOT NULL);
    CREATE TABLE "Notification" ("id" TEXT PRIMARY KEY, "createdAt" TEXT NOT NULL, "isRead" INTEGER NOT NULL, "userId" TEXT NOT NULL, "sourceUserId" TEXT);
    CREATE INDEX "Comment_reviewId_idx" ON "Comment" ("reviewId");
    CREATE INDEX "DiaryLog_userId_listenedAt_idx" ON "DiaryLog" ("userId", "listenedAt");
    CREATE INDEX "Notification_userId_isRead_idx" ON "Notification" ("userId", "isRead");
  `);

  for (let index = 0; index < USERS; index += 1) {
    await execute(client, 'INSERT INTO "User" ("id", "username", "profileColor") VALUES (?, ?, ?)', [
      `user-${index}`, `user-${index}`, "emerald",
    ]);
  }
  for (let index = 0; index < COLLECTION_SIZE; index += 1) {
    const timestamp = `2026-01-${String((index % 28) + 1).padStart(2, "0")}T12:${String(index % 5).padStart(2, "0")}:00.000Z`;
    const userId = `user-${index % USERS}`;
    await execute(client, 'INSERT INTO "MusicItem" VALUES (?, ?, ?, ?)', [`album-${index}`, `Album ${index}`, "Artist", "cover"]);
    await execute(client, 'INSERT INTO "List" VALUES (?, ?, ?, ?, ?)', [`list-${index}`, `List ${index}`, index % 3 !== 0 ? 1 : 0, timestamp, userId]);
    await execute(client, 'INSERT INTO "Review" VALUES (?, ?, ?, ?, ?, ?)', [`review-${index}`, `Review ${index}`, 4, timestamp, userId, "album-0"]);
    await execute(client, 'INSERT INTO "Comment" VALUES (?, ?, ?, ?, ?)', [`comment-${index}`, `Comment ${index}`, timestamp, "review-0", userId]);
    await execute(client, 'INSERT INTO "DiaryLog" VALUES (?, ?, ?, ?, ?)', [`diary-${index}`, timestamp, timestamp, "user-0", `album-${index}`]);
    await execute(client, 'INSERT INTO "ListenLater" VALUES (?, ?, ?, ?)', [`later-${index}`, timestamp, "user-0", `album-${index}`]);
    await execute(client, 'INSERT INTO "Notification" VALUES (?, ?, ?, ?, ?)', [`notification-${index}`, timestamp, index % 2, "user-0", userId]);
    await execute(client, 'INSERT INTO "Rating" VALUES (?, ?, ?, ?)', [`rating-${index}`, (index % 10) / 2 + 0.5, userId, "album-0"]);
  }
  for (let index = 0; index < 100; index += 1) {
    await execute(client, 'INSERT INTO "ListItem" VALUES (?, ?, ?, ?)', [`list-item-${index}`, "list-0", `album-${index}`, index]);
  }
}

async function collectionMeasurement(
  client: Client,
  name: string,
  sql: string,
  args: SqlArg[],
  queryCount = 1,
): Promise<Measurement> {
  const plan = await explain(client, sql, args);
  const { result, localMs } = await timed(() => execute(client, sql, args));
  return {
    name,
    queries: queryCount,
    rows: result.rows.length,
    responseBytes: Buffer.byteLength(JSON.stringify(result.rows)),
    localMs,
    plan,
  };
}

async function notificationsMeasurement(client: Client, indexed: boolean): Promise<Measurement> {
  const notificationSql = 'SELECT "id", "sourceUserId", "createdAt", "isRead" FROM "Notification" WHERE "userId" = ? ORDER BY "createdAt" DESC, "id" DESC LIMIT ?';
  const plan = await explain(client, notificationSql, ["user-0", PAGE_SIZE]);
  let queries = 0;
  const { result, localMs } = await timed(async () => {
    queries += 1;
    const notifications = await execute(client, notificationSql, ["user-0", PAGE_SIZE]);
    const sourceIds = Array.from(new Set(notifications.rows.map((row) => value<string | null>(row, "sourceUserId")).filter(Boolean))) as string[];
    if (indexed) {
      queries += 1;
      await execute(client, `SELECT "id", "username", "profileImage", "profileColor" FROM "User" WHERE "id" IN (${sourceIds.map(() => "?").join(",")})`, sourceIds);
    } else {
      for (const sourceId of sourceIds) {
        queries += 1;
        await execute(client, 'SELECT "username", "profileImage", "profileColor" FROM "User" WHERE "id" = ?', [sourceId]);
      }
    }
    queries += 1;
    await execute(client, 'SELECT COUNT(*) AS "count" FROM "Notification" WHERE "userId" = ? AND "isRead" = 0', ["user-0"]);
    return notifications;
  });
  return {
    name: indexed ? "notifications-after" : "notifications-before",
    queries,
    rows: result.rows.length,
    responseBytes: Buffer.byteLength(JSON.stringify(result.rows)),
    localMs,
    plan,
  };
}

async function measure(client: Client, phase: "before" | "after") {
  const suffix = phase === "before" ? "before" : "after";
  return Promise.all([
    collectionMeasurement(client, `public-lists-${suffix}`, 'SELECT "id", "title", "createdAt" FROM "List" WHERE "isPublic" = 1 ORDER BY "createdAt" DESC, "id" DESC LIMIT ?', [PAGE_SIZE]),
    collectionMeasurement(client, `comments-${suffix}`, 'SELECT "id", "content", "createdAt" FROM "Comment" WHERE "reviewId" = ? ORDER BY "createdAt" ASC, "id" ASC LIMIT ?', ["review-0", PAGE_SIZE]),
    collectionMeasurement(client, `diary-${suffix}`, 'SELECT "id", "listenedAt" FROM "DiaryLog" WHERE "userId" = ? ORDER BY "listenedAt" DESC, "id" DESC LIMIT ?', ["user-0", PAGE_SIZE]),
    collectionMeasurement(client, `listen-later-${suffix}`, 'SELECT "id", "createdAt" FROM "ListenLater" WHERE "userId" = ? ORDER BY "createdAt" DESC, "id" DESC LIMIT ?', ["user-0", PAGE_SIZE]),
    collectionMeasurement(client, `album-reviews-${suffix}`, 'SELECT "id", "createdAt" FROM "Review" WHERE "musicItemId" = ? ORDER BY "createdAt" DESC, "id" DESC LIMIT ?', ["album-0", PAGE_SIZE]),
    notificationsMeasurement(client, phase === "after"),
  ]);
}

async function main() {
  const client = createClient({ url: "file::memory:?cache=shared" });
  try {
    await seed(client);
    const before = await measure(client, "before");
    await client.executeMultiple(`
      CREATE INDEX "List_isPublic_createdAt_id_idx" ON "List" ("isPublic", "createdAt", "id");
      CREATE INDEX "Comment_reviewId_createdAt_id_idx" ON "Comment" ("reviewId", "createdAt", "id");
      CREATE INDEX "DiaryLog_userId_listenedAt_id_idx" ON "DiaryLog" ("userId", "listenedAt", "id");
      CREATE INDEX "ListenLater_userId_createdAt_id_idx" ON "ListenLater" ("userId", "createdAt", "id");
      CREATE INDEX "Review_musicItemId_createdAt_id_idx" ON "Review" ("musicItemId", "createdAt", "id");
      CREATE INDEX "Notification_userId_createdAt_id_idx" ON "Notification" ("userId", "createdAt", "id");
    `);
    const after = await measure(client, "after");
    console.log(JSON.stringify({ dataset: { users: USERS, collectionSize: COLLECTION_SIZE, pageSize: PAGE_SIZE }, before, after }, null, 2));
  } finally {
    client.close();
  }
}

void main();
