import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { createClient, type Client } from "@libsql/client";

const projectRoot = resolve(import.meta.dirname, "..");
const baselinePath = join(
  projectRoot,
  "prisma",
  "migrations",
  "00000000000000_baseline",
  "migration.sql",
);
const ratingMigrationPath = join(
  projectRoot,
  "prisma",
  "migrations",
  "20260802183000_unique_current_rating",
  "migration.sql",
);

async function database(): Promise<{ client: Client }> {
  const client = createClient({ url: "file::memory:" });
  await client.executeMultiple(await readFile(baselinePath, "utf8"));
  await client.executeMultiple(`
    PRAGMA foreign_keys = ON;
    INSERT INTO "User" ("id", "username", "email", "password", "updatedAt") VALUES
      ('user-a', 'alice', 'alice@example.test', 'hash', '2026-01-01T00:00:00.000Z'),
      ('user-b', 'bob', 'bob@example.test', 'hash', '2026-01-01T00:00:00.000Z');
    INSERT INTO "MusicItem" ("id", "title", "artist", "type", "coverUrl", "releaseYear") VALUES
      ('album-a', 'Album A', 'Artist', 'ALBUM', 'https://example.test/a.jpg', 2026),
      ('album-b', 'Album B', 'Artist', 'ALBUM', 'https://example.test/b.jpg', 2026);
  `);
  return { client };
}

async function ratingIndexes(client: Client) {
  return client.execute(`
    SELECT name, "unique"
    FROM pragma_index_list('Rating')
    WHERE name NOT LIKE 'sqlite_autoindex_%'
    ORDER BY name
  `);
}

test("la migración deduplica Rating de forma determinista y crea la unicidad", async () => {
  const context = await database();
  try {
    await context.client.executeMultiple(`
      INSERT INTO "Review" ("id", "content", "ratingValue", "createdAt", "updatedAt", "userId", "musicItemId")
        VALUES ('review-a', 'Review preserved', 4.5, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 'user-a', 'album-a');
      INSERT INTO "Rating" ("id", "value", "createdAt", "updatedAt", "userId", "musicItemId") VALUES
        ('a-old', 1.0, '2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z', 'user-a', 'album-a'),
        ('a-new', 4.5, '2026-01-03T00:00:00.000Z', '2026-02-01T00:00:00.000Z', 'user-a', 'album-a'),
        ('b-a', 2.0, '2026-03-01T00:00:00.000Z', '2026-03-02T00:00:00.000Z', 'user-a', 'album-b'),
        ('b-z', 3.0, '2026-03-01T00:00:00.000Z', '2026-03-02T00:00:00.000Z', 'user-a', 'album-b'),
        ('c-only', 5.0, '2026-04-01T00:00:00.000Z', '2026-04-01T00:00:00.000Z', 'user-b', 'album-a'),
        ('d-old', 2.5, '2026-05-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z', 'user-b', 'album-b'),
        ('d-new', 3.5, '2026-05-02T00:00:00.000Z', '2026-06-01T00:00:00.000Z', 'user-b', 'album-b');
    `);

    const before = await context.client.execute(`
      SELECT COUNT(*) AS totalRows,
             COUNT(*) - COUNT(DISTINCT userId || char(0) || musicItemId) AS redundantRows
      FROM Rating
    `);
    const duplicateGroups = await context.client.execute(`
      SELECT COUNT(*) AS count FROM (
        SELECT 1 FROM Rating GROUP BY userId, musicItemId HAVING COUNT(*) > 1
      )
    `);
    assert.equal(Number(before.rows[0]?.totalRows), 7);
    assert.equal(Number(before.rows[0]?.redundantRows), 3);
    assert.equal(Number(duplicateGroups.rows[0]?.count), 3);

    await context.client.executeMultiple(await readFile(ratingMigrationPath, "utf8"));

    const rows = await context.client.execute(
      'SELECT id, value FROM "Rating" ORDER BY id',
    );
    assert.deepEqual(
      rows.rows.map((row) => [String(row.id), Number(row.value)]),
      [
        ["a-new", 4.5],
        ["b-z", 3],
        ["c-only", 5],
        ["d-new", 3.5],
      ],
    );
    assert.equal((await context.client.execute('SELECT COUNT(*) AS count FROM "Review"')).rows[0]?.count, 1);
    assert.deepEqual((await context.client.execute("PRAGMA foreign_key_check")).rows, []);
    assert.deepEqual(
      (await ratingIndexes(context.client)).rows.map((row) => [row.name, Number(row.unique)]),
      [["Rating_userId_musicItemId_key", 1]],
    );
    await assert.rejects(
      context.client.execute({
        sql: 'INSERT INTO "Rating" ("id", "value", "updatedAt", "userId", "musicItemId") VALUES (?, ?, ?, ?, ?)',
        args: ["duplicate", 4, "2026-08-01T00:00:00.000Z", "user-a", "album-a"],
      }),
      /UNIQUE constraint failed/i,
    );
  } finally {
    context.client.close();
  }
});

test("la migración sin duplicados conserva ID, datos, relaciones y foreign keys", async () => {
  const context = await database();
  try {
    await context.client.executeMultiple(`
      INSERT INTO "Review" ("id", "content", "ratingValue", "createdAt", "updatedAt", "userId", "musicItemId")
        VALUES ('review-only', 'Review preserved', 4.0, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 'user-a', 'album-a');
      INSERT INTO "Rating" ("id", "value", "createdAt", "updatedAt", "userId", "musicItemId")
        VALUES ('rating-only', 4.0, '2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z', 'user-a', 'album-a');
    `);
    const before = await context.client.execute('SELECT * FROM "Rating"');

    await context.client.executeMultiple(await readFile(ratingMigrationPath, "utf8"));

    const after = await context.client.execute('SELECT * FROM "Rating"');
    assert.deepEqual(after.rows, before.rows);
    assert.equal((await context.client.execute('SELECT COUNT(*) AS count FROM "Review"')).rows[0]?.count, 1);
    assert.deepEqual((await context.client.execute("PRAGMA foreign_key_check")).rows, []);
    assert.deepEqual(
      (await ratingIndexes(context.client)).rows.map((row) => [row.name, Number(row.unique)]),
      [["Rating_userId_musicItemId_key", 1]],
    );
  } finally {
    context.client.close();
  }
});

test("la migración aborta antes de deduplicar datos inesperados", async () => {
  const context = await database();
  try {
    await context.client.execute(`
      INSERT INTO "Rating" ("id", "value", "createdAt", "updatedAt", "userId", "musicItemId")
      VALUES ('invalid-rating', 4.0, 'not-a-date', '2026-01-01T00:00:00.000Z', 'user-a', 'album-a')
    `);

    await assert.rejects(
      context.client.executeMultiple(await readFile(ratingMigrationPath, "utf8")),
      /CHECK constraint failed/i,
    );

    assert.equal((await context.client.execute('SELECT COUNT(*) AS count FROM "Rating"')).rows[0]?.count, 1);
    const indexes = await ratingIndexes(context.client);
    assert.ok(indexes.rows.some((row) => row.name === "Rating_userId_musicItemId_idx"));
    assert.ok(!indexes.rows.some((row) => row.name === "Rating_userId_musicItemId_key"));
  } finally {
    context.client.close();
  }
});
