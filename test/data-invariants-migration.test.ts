import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { createClient } from "@libsql/client";

const projectRoot = resolve(import.meta.dirname, "..");
const migrationsRoot = join(projectRoot, "prisma", "migrations");
const dataInvariantsMigration = "20260804123000_data_invariants";

async function migrationNames() {
  return (await readdir(migrationsRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && /^\d+_[a-z0-9_]+$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

async function applyMigration(client: ReturnType<typeof createClient>, name: string) {
  await client.executeMultiple(await readFile(join(migrationsRoot, name, "migration.sql"), "utf8"));
}

async function migratedClient() {
  const client = createClient({ url: "file::memory:" });
  const migrations = await migrationNames();
  for (const name of migrations) {
    await applyMigration(client, name);
  }
  return client;
}

async function clientBeforeDataInvariants() {
  const client = createClient({ url: "file::memory:" });
  for (const name of await migrationNames()) {
    if (name === dataInvariantsMigration) break;
    await applyMigration(client, name);
  }
  return client;
}

test("la migración RTM-DATA-008 protege invariantes escalares con SQLite/libSQL", async () => {
  const client = await migratedClient();
  try {
    await client.executeMultiple(`
      INSERT INTO "User" ("id", "username", "email", "password", "updatedAt")
        VALUES ('user-a', 'alice', 'alice@example.test', 'hash', CURRENT_TIMESTAMP);
      INSERT INTO "MusicItem" ("id", "title", "artist", "type", "coverUrl", "releaseYear")
        VALUES ('album-a', 'Album', 'Artist', 'ALBUM', 'https://example.test/a.jpg', 2026);
    `);

    await assert.rejects(client.execute({
      sql: `INSERT INTO "Rating" ("id", "value", "updatedAt", "userId", "musicItemId") VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?)`,
      args: ["rating-invalid", 5.25, "user-a", "album-a"],
    }));
    await assert.rejects(client.execute({
      sql: `INSERT INTO "Review" ("id", "content", "ratingValue", "updatedAt", "userId", "musicItemId") VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?)`,
      args: ["review-invalid", "   ", 4, "user-a", "album-a"],
    }));
    await assert.rejects(client.execute({
      sql: `INSERT INTO "DiaryLog" ("id", "ratingValue", "notes", "userId", "musicItemId") VALUES (?, ?, ?, ?, ?)`,
      args: ["diary-invalid", 0, "note", "user-a", "album-a"],
    }));
    await assert.rejects(client.execute({
      sql: `INSERT INTO "MusicItem" ("id", "title", "artist", "type", "coverUrl", "releaseYear") VALUES (?, ?, ?, ?, ?, ?)`,
      args: ["artist-invalid", "Artist", "Artist", "ARTIST", "https://example.test/a.jpg", 2026],
    }));
    await assert.rejects(client.execute({
      sql: `INSERT INTO "FavoriteAlbum" ("id", "userId", "musicItemId", "slot") VALUES (?, ?, ?, ?)`,
      args: ["favorite-invalid", "user-a", "album-a", 4],
    }));
    await assert.rejects(client.execute({
      sql: `INSERT INTO "MusicEvent" ("id", "dateMonth", "dateDay", "artistName", "artistId", "eventType") VALUES (?, ?, ?, ?, ?, ?)`,
      args: ["event-invalid", 13, 1, "Artist", "1", "BIRTH"],
    }));

    await client.execute({
      sql: `INSERT INTO "Rating" ("id", "value", "updatedAt", "userId", "musicItemId") VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?)`,
      args: ["rating-valid", 4.5, "user-a", "album-a"],
    });
    assert.equal((await client.execute('SELECT COUNT(*) AS count FROM "Rating"')).rows[0]?.count, 1);
    assert.deepEqual((await client.execute("PRAGMA foreign_key_check")).rows, []);
  } finally {
    client.close();
  }
});

test("RTM-DATA-008 conserva datos válidos y aborta antes de proteger datos incompatibles", async (t) => {
  await t.test("upgrade con datos válidos", async () => {
    const client = await clientBeforeDataInvariants();
    try {
      await client.executeMultiple(`
        INSERT INTO "User" ("id", "username", "email", "password", "updatedAt") VALUES ('user-a', 'alice', 'alice@example.test', 'hash', CURRENT_TIMESTAMP);
        INSERT INTO "MusicItem" ("id", "title", "artist", "type", "coverUrl", "releaseYear") VALUES ('album-a', 'Album', 'Artist', 'ALBUM', 'https://example.test/a.jpg', 2026);
        INSERT INTO "Rating" ("id", "value", "updatedAt", "userId", "musicItemId") VALUES ('rating-a', 4.5, CURRENT_TIMESTAMP, 'user-a', 'album-a');
      `);
      await applyMigration(client, dataInvariantsMigration);
      assert.equal((await client.execute('SELECT COUNT(*) AS count FROM "Rating"')).rows[0]?.count, 1);
    } finally {
      client.close();
    }
  });

  await t.test("preflight incompatible", async () => {
    const client = await clientBeforeDataInvariants();
    try {
      await client.execute({
        sql: `INSERT INTO "MusicItem" ("id", "title", "artist", "type", "coverUrl", "releaseYear") VALUES (?, ?, ?, ?, ?, ?)`,
        args: ["invalid", "Invalid", "Artist", "ARTIST", "https://example.test/a.jpg", 2026],
      });
      await assert.rejects(applyMigration(client, dataInvariantsMigration));
      assert.equal((await client.execute("SELECT COUNT(*) AS count FROM sqlite_schema WHERE type = 'trigger' AND name = 'MusicItem_validate_insert'")).rows[0]?.count, 0);
    } finally {
      client.close();
    }
  });
});
