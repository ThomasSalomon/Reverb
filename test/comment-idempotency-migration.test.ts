import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { createClient } from "@libsql/client";

test("la migración de idempotencia conserva comentarios y restringe sólo claves no nulas", async () => {
  const url = "file::memory:?cache=shared";
  const client = createClient({ url });
  const migrations = resolve(import.meta.dirname, "..", "prisma", "migrations");
  try {
    await client.executeMultiple(
      await readFile(resolve(migrations, "00000000000000_baseline", "migration.sql"), "utf8"),
    );
    await client.executeMultiple(`
      INSERT INTO "User" ("id", "username", "email", "password", "updatedAt")
        VALUES ('migration-user', 'migration-user', 'migration@example.test', 'hash', CURRENT_TIMESTAMP);
      INSERT INTO "MusicItem" ("id", "title", "artist", "type", "coverUrl", "releaseYear")
        VALUES ('migration-album', 'Album', 'Artist', 'ALBUM', 'https://example.test/a.jpg', 2026);
      INSERT INTO "Review" ("id", "content", "ratingValue", "updatedAt", "userId", "musicItemId")
        VALUES ('migration-review', 'Review', 4, CURRENT_TIMESTAMP, 'migration-user', 'migration-album');
      INSERT INTO "Comment" ("id", "content", "updatedAt", "userId", "reviewId") VALUES
        ('comment-a', 'Same text', CURRENT_TIMESTAMP, 'migration-user', 'migration-review'),
        ('comment-b', 'Same text', CURRENT_TIMESTAMP, 'migration-user', 'migration-review');
    `);

    await client.executeMultiple(
      await readFile(
        resolve(migrations, "20260804120000_comment_idempotency", "migration.sql"),
        "utf8",
      ),
    );

    const preserved = await client.execute(
      'SELECT id, "operationId" FROM "Comment" ORDER BY id',
    );
    assert.deepEqual(preserved.rows, [
      { id: "comment-a", operationId: null },
      { id: "comment-b", operationId: null },
    ]);

    await client.execute(
      `INSERT INTO "Comment" ("id", "content", "operationId", "updatedAt", "userId", "reviewId")
       VALUES ('comment-c', 'New', '11111111-1111-4111-8111-111111111111', CURRENT_TIMESTAMP, 'migration-user', 'migration-review')`,
    );
    await assert.rejects(() =>
      client.execute(
        `INSERT INTO "Comment" ("id", "content", "operationId", "updatedAt", "userId", "reviewId")
         VALUES ('comment-d', 'Other', '11111111-1111-4111-8111-111111111111', CURRENT_TIMESTAMP, 'migration-user', 'migration-review')`,
      ),
    );
    assert.deepEqual((await client.execute("PRAGMA foreign_key_check")).rows, []);
  } finally {
    client.close();
  }
});

