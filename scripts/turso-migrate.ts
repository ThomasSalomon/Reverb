import "dotenv/config";

import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createClient, type Client } from "@libsql/client";

const migrationsRoot = resolve(process.cwd(), "prisma", "migrations");
const ledgerTable = "_musicbox_migrations";
const ignoredTables = new Set([ledgerTable, "_prisma_migrations"]);
const legacyRatingMigrationName = "20260802183000_unique_current_rating";
const legacyCollectionIndexReconciliationName =
  "20260802183100_legacy_unique_collection_indexes";

type Migration = {
  name: string;
  sql: string;
  checksum: string;
};

type Command = "status" | "apply" | "adopt";

function usage(): never {
  console.error(
    [
      "Uso:",
      "  tsx scripts/turso-migrate.ts status",
      "  tsx scripts/turso-migrate.ts apply <migration>",
      "  tsx scripts/turso-migrate.ts adopt <migration>",
      "",
      "apply/adopt requieren MUSICBOX_MIGRATION_CONFIRM=<host de TURSO_DATABASE_URL>.",
      "adopt registra SQL ya presente sólo después de validar equivalencia estructural.",
    ].join("\n"),
  );
  process.exit(2);
}

async function loadMigrations(): Promise<Migration[]> {
  const entries = await readdir(migrationsRoot, { withFileTypes: true });
  const names = entries
    .filter((entry) => entry.isDirectory() && /^\d+_[a-z0-9_]+$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort();

  if (names.length === 0) {
    throw new Error("No hay migraciones versionadas en prisma/migrations.");
  }

  return Promise.all(
    names.map(async (name) => {
      const sql = await readFile(join(migrationsRoot, name, "migration.sql"), "utf8");
      return {
        name,
        sql,
        checksum: createHash("sha256").update(sql).digest("hex"),
      };
    }),
  );
}

function targetIdentity(url: string): string {
  if (url.startsWith("file:")) return "local-test";
  try {
    return new URL(url).hostname;
  } catch {
    throw new Error("TURSO_DATABASE_URL no es una URL válida.");
  }
}

function connect(): { client: Client; identity: string } {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) throw new Error("Falta TURSO_DATABASE_URL.");

  const isLocal = url.startsWith("file:");
  if (isLocal && process.env.MUSICBOX_MIGRATION_ALLOW_LOCAL !== "1") {
    throw new Error("Las URLs file: sólo se habilitan en pruebas controladas.");
  }
  if (!isLocal && !url.startsWith("libsql://")) {
    throw new Error("El runner remoto sólo acepta URLs libsql:// de Turso.");
  }
  if (!isLocal && !authToken) throw new Error("Falta TURSO_AUTH_TOKEN.");

  return {
    client: createClient({ url, ...(authToken ? { authToken } : {}) }),
    identity: targetIdentity(url),
  };
}

function requireConfirmation(identity: string): void {
  if (process.env.MUSICBOX_MIGRATION_CONFIRM !== identity) {
    throw new Error(
      `Operación rechazada: MUSICBOX_MIGRATION_CONFIRM debe ser exactamente ${identity}.`,
    );
  }
}

async function ledgerExists(client: Client): Promise<boolean> {
  const result = await client.execute({
    sql: "SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = ? LIMIT 1",
    args: [ledgerTable],
  });
  return result.rows.length === 1;
}

async function appliedMigrations(client: Client): Promise<Map<string, string>> {
  if (!(await ledgerExists(client))) return new Map();
  const result = await client.execute(
    `SELECT name, checksum FROM "${ledgerTable}" ORDER BY name`,
  );
  return new Map(
    result.rows.map((row) => [String(row.name), String(row.checksum)]),
  );
}

async function status(client: Client, migrations: Migration[]): Promise<void> {
  const applied = await appliedMigrations(client);
  for (const migration of migrations) {
    const actual = applied.get(migration.name);
    const state = !actual
      ? "pending"
      : actual === migration.checksum
        ? "applied"
        : "CHECKSUM_MISMATCH";
    console.log(`${state.padEnd(18)} ${migration.name} ${migration.checksum.slice(0, 12)}`);
  }

  for (const name of Array.from(applied.keys()).filter(
    (candidate) => !migrations.some((migration) => migration.name === candidate),
  )) {
    console.log(`${"UNKNOWN_REMOTE".padEnd(18)} ${name}`);
  }
}

function assertOrder(
  migrations: Migration[],
  target: Migration,
  applied: Map<string, string>,
): void {
  for (const name of Array.from(applied.keys())) {
    if (!migrations.some((migration) => migration.name === name)) {
      throw new Error(`El destino registra una migración desconocida: ${name}.`);
    }
  }

  const targetIndex = migrations.findIndex((migration) => migration.name === target.name);
  for (const previous of migrations.slice(0, targetIndex)) {
    if (applied.get(previous.name) !== previous.checksum) {
      throw new Error(`Falta la migración previa ${previous.name} o su checksum no coincide.`);
    }
  }

  const current = applied.get(target.name);
  if (current && current !== target.checksum) {
    throw new Error(`El checksum remoto de ${target.name} no coincide con el repositorio.`);
  }
}

function assertTransactionCompatible(migration: Migration): void {
  const unsupported = /\b(?:BEGIN|COMMIT|ROLLBACK)\b|PRAGMA\s+foreign_keys\s*=/i;
  if (unsupported.test(migration.sql)) {
    throw new Error(
      `${migration.name} contiene control transaccional o PRAGMA foreign_keys. ` +
        "Requiere revisión y aplicación manual según docs/database-migrations.md.",
    );
  }
}

async function userTableNames(client: Client): Promise<string[]> {
  const result = await client.execute(
    "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  return result.rows
    .map((row) => String(row.name))
    .filter((name) => !ignoredTables.has(name));
}

function stableValue(value: unknown): string | number | null {
  if (value === null || typeof value === "number") return value;
  if (typeof value === "bigint") return value.toString();
  return String(value);
}

async function schemaSnapshot(client: Client): Promise<unknown> {
  const tables = await userTableNames(client);
  const snapshot = [];

  for (const table of tables) {
    const escaped = table.replaceAll('"', '""');
    const columns = await client.execute(`PRAGMA table_info("${escaped}")`);
    const foreignKeys = await client.execute(`PRAGMA foreign_key_list("${escaped}")`);
    const indexList = await client.execute(`PRAGMA index_list("${escaped}")`);
    const indexes = [];

    for (const row of indexList.rows) {
      const indexName = String(row.name);
      if (indexName.startsWith("sqlite_autoindex_")) continue;
      const indexEscaped = indexName.replaceAll('"', '""');
      const info = await client.execute(`PRAGMA index_info("${indexEscaped}")`);
      indexes.push({
        name: indexName,
        unique: stableValue(row.unique),
        columns: info.rows.map((item) => String(item.name)),
      });
    }

    snapshot.push({
      table,
      columns: columns.rows.map((row) => ({
        name: String(row.name),
        type: String(row.type).toUpperCase(),
        notnull: stableValue(row.notnull),
        default: stableValue(row.dflt_value),
        pk: stableValue(row.pk),
      })),
      foreignKeys: foreignKeys.rows
        .map((row) => ({
          from: String(row.from),
          to: String(row.to),
          table: String(row.table),
          onUpdate: String(row.on_update),
          onDelete: String(row.on_delete),
        }))
        .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
      indexes: indexes.sort((a, b) => a.name.localeCompare(b.name)),
    });
  }

  const triggers = await client.execute(
    "SELECT name, tbl_name, sql FROM sqlite_schema WHERE type = 'trigger' ORDER BY name",
  );

  return {
    tables: snapshot,
    triggers: triggers.rows.map((row) => ({
      name: String(row.name),
      table: String(row.tbl_name),
      sql: String(row.sql),
    })),
  };
}

async function assertIntegrity(client: Client): Promise<void> {
  const integrity = await client.execute("PRAGMA quick_check");
  if (integrity.rows.length !== 1 || String(integrity.rows[0]?.quick_check) !== "ok") {
    throw new Error("PRAGMA quick_check detectó una base inconsistente.");
  }
  const foreignKeys = await client.execute("PRAGMA foreign_key_check");
  if (foreignKeys.rows.length > 0) {
    throw new Error(`PRAGMA foreign_key_check detectó ${foreignKeys.rows.length} violaciones.`);
  }
}

async function expectedSnapshot(
  migrations: Migration[],
  target: Migration,
): Promise<unknown> {
  const local = createClient({ url: "file::memory:" });
  try {
    for (const migration of migrations) {
      await local.executeMultiple(migration.sql);
      if (migration.name === target.name) break;
    }
    return await schemaSnapshot(local);
  } finally {
    local.close();
  }
}

/**
 * Two pre-ledger deployments used unique indexes for the collection lookups.
 * This is the only accepted schema variant: every other object must still
 * match the requested migration exactly. The following reconciliation migration
 * removes these unintended uniqueness constraints without changing any rows.
 */
function matchesExpectedSnapshot(
  expected: unknown,
  actual: unknown,
  allowLegacyCollectionIndexes = false,
): boolean {
  if (JSON.stringify(actual) === JSON.stringify(expected)) return true;
  if (!allowLegacyCollectionIndexes || !actual || typeof actual !== "object") return false;

  const normalized = structuredClone(actual) as {
    tables?: Array<{ table?: string; indexes?: Array<{ name?: string; unique?: string | number }> }>;
  };
  const replacements = [
    {
      table: "DiaryLog",
      legacyName: "DiaryLog_userId_musicItemId_key",
      canonicalName: "DiaryLog_userId_musicItemId_idx",
    },
    {
      table: "Review",
      legacyName: "Review_userId_musicItemId_key",
      canonicalName: "Review_userId_musicItemId_idx",
    },
  ];

  for (const replacement of replacements) {
    const table = normalized.tables?.find((candidate) => candidate.table === replacement.table);
    const index = table?.indexes?.find((candidate) => candidate.name === replacement.legacyName);
    if (!index || String(index.unique) !== "1") return false;
    index.name = replacement.canonicalName;
    index.unique = 0;
    table?.indexes?.sort((left, right) => String(left.name).localeCompare(String(right.name)));
  }

  return JSON.stringify(normalized) === JSON.stringify(expected);
}

async function adopt(
  client: Client,
  migrations: Migration[],
  target: Migration,
): Promise<void> {
  const applied = await appliedMigrations(client);
  const targetIndex = migrations.findIndex((migration) => migration.name === target.name);
  // A pre-ledger database may already include consecutive migrations. Its
  // schema is compared against the requested point before any checksum is
  // recorded; this path does not execute functional migration SQL.
  const adoptingUntrackedPrefix = applied.size === 0;
  if (!adoptingUntrackedPrefix) {
    assertOrder(migrations, target, applied);
  }
  if (applied.get(target.name) === target.checksum) {
    console.log(`${target.name} ya estaba adoptada con el mismo checksum.`);
    return;
  }

  const [expected, actual] = await Promise.all([
    expectedSnapshot(migrations, target),
    schemaSnapshot(client),
  ]);
  if (!matchesExpectedSnapshot(expected, actual, target.name === legacyRatingMigrationName)) {
    throw new Error(
      "La estructura remota no equivale al historial hasta la migración indicada; no se registró nada.",
    );
  }
  await assertIntegrity(client);

  const transaction = await client.transaction("write");
  try {
    await transaction.execute(
      `CREATE TABLE IF NOT EXISTS "${ledgerTable}" (` +
        '"name" TEXT NOT NULL PRIMARY KEY, "checksum" TEXT NOT NULL, ' +
        '"applied_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)',
    );
    const migrationsToRecord = adoptingUntrackedPrefix
      ? migrations.slice(0, targetIndex + 1)
      : [target];
    for (const migration of migrationsToRecord) {
      await transaction.execute({
        sql: `INSERT INTO "${ledgerTable}" (name, checksum) VALUES (?, ?)`,
        args: [migration.name, migration.checksum],
      });
    }
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  } finally {
    transaction.close();
  }
  console.log(`${target.name} adoptada después de validar equivalencia.`);
}

async function applyMigration(
  client: Client,
  migrations: Migration[],
  target: Migration,
): Promise<void> {
  const applied = await appliedMigrations(client);
  assertOrder(migrations, target, applied);
  if (applied.get(target.name) === target.checksum) {
    console.log(`${target.name} ya está aplicada con el mismo checksum.`);
    return;
  }
  assertTransactionCompatible(target);

  const targetIndex = migrations.findIndex((migration) => migration.name === target.name);
  if (targetIndex === 0) {
    if ((await userTableNames(client)).length > 0) {
      throw new Error("El baseline sólo puede ejecutarse sobre una base vacía; use adopt en una base existente.");
    }
  } else {
    const expected = await expectedSnapshot(migrations, migrations[targetIndex - 1]);
    const actual = await schemaSnapshot(client);
    const allowsLegacyCollectionIndexes =
      target.name === legacyCollectionIndexReconciliationName;
    if (!matchesExpectedSnapshot(expected, actual, allowsLegacyCollectionIndexes)) {
      throw new Error("El esquema remoto tiene drift respecto del historial aplicado; no se ejecutó nada.");
    }
  }
  await assertIntegrity(client);

  const transaction = await client.transaction("write");
  try {
    await transaction.execute(
      `CREATE TABLE IF NOT EXISTS "${ledgerTable}" (` +
        '"name" TEXT NOT NULL PRIMARY KEY, "checksum" TEXT NOT NULL, ' +
        '"applied_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)',
    );
    await transaction.executeMultiple(target.sql);
    await transaction.execute({
      sql: `INSERT INTO "${ledgerTable}" (name, checksum) VALUES (?, ?)`,
      args: [target.name, target.checksum],
    });
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  } finally {
    transaction.close();
  }
  await assertIntegrity(client);
  console.log(`${target.name} aplicada y registrada atómicamente.`);
}

async function main(): Promise<void> {
  const command = process.argv[2] as Command | undefined;
  if (!command || !["status", "apply", "adopt"].includes(command)) usage();

  const migrations = await loadMigrations();
  const { client, identity } = connect();
  try {
    console.error(`Destino de migraciones: ${identity}`);
    if (command === "status") {
      await status(client, migrations);
      return;
    }

    requireConfirmation(identity);
    const name = process.argv[3];
    if (!name) usage();
    const target = migrations.find((migration) => migration.name === name);
    if (!target) throw new Error(`Migración desconocida: ${name}.`);

    if (command === "adopt") await adopt(client, migrations, target);
    else await applyMigration(client, migrations, target);
  } finally {
    client.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error de migración: ${message}`);
  process.exitCode = 1;
});
