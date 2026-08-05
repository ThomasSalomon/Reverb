import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { createClient } from "@libsql/client";

test("la migración de sesiones revocables conserva usuarios existentes y aplica cascada", async () => {
  const client = createClient({ url: "file::memory:?cache=shared" });
  const migrations = resolve(import.meta.dirname, "..", "prisma", "migrations");
  try {
    await client.executeMultiple(
      await readFile(resolve(migrations, "00000000000000_baseline", "migration.sql"), "utf8"),
    );
    await client.execute(`INSERT INTO "User" ("id", "username", "email", "password", "updatedAt")
      VALUES ('legacy-user', 'legacy', 'legacy@example.test', 'hash', CURRENT_TIMESTAMP)`);

    await client.executeMultiple(
      await readFile(resolve(migrations, "20260804140000_revocable_sessions", "migration.sql"), "utf8"),
    );

    const user = await client.execute(
      'SELECT "credentialsVersion" FROM "User" WHERE "id" = ?',
      ["legacy-user"],
    );
    assert.deepEqual(user.rows, [{ credentialsVersion: 0 }]);

    await client.execute(`INSERT INTO "AuthSession"
      ("id", "userId", "credentialsVersion", "expiresAt")
      VALUES ('session-1', 'legacy-user', 0, '2099-01-01T00:00:00.000Z')`);
    await client.execute('DELETE FROM "User" WHERE "id" = ?', ["legacy-user"]);
    assert.equal((await client.execute('SELECT COUNT(*) AS count FROM "AuthSession"')).rows[0]?.count, 0);
    assert.deepEqual((await client.execute("PRAGMA foreign_key_check")).rows, []);
  } finally {
    client.close();
  }
});
