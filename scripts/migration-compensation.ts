import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const name = process.argv[2];
  if (!name || !/^\d+_[a-z0-9_]+$/i.test(name)) {
    throw new Error("Uso: tsx scripts/migration-compensation.ts <migración>");
  }

  const directory = resolve(process.cwd(), "prisma", "migrations", name);
  const migrationPath = join(directory, "migration.sql");
  if (!(await exists(migrationPath))) throw new Error(`Migración desconocida: ${name}.`);

  const sql = await readFile(migrationPath, "utf8");
  const checksum = createHash("sha256").update(sql).digest("hex");
  const compensationPath = join(directory, "compensation.sql");
  const hasReviewedSql = await exists(compensationPath);

  console.log(`Migración: ${name}`);
  console.log(`SHA-256: ${checksum}`);
  console.log(`SQL de compensación revisado: ${hasReviewedSql ? compensationPath : "no disponible"}`);
  console.log("");
  console.log("Plan obligatorio antes de mutar un entorno:");
  console.log("1. Detener escrituras y conservar el destino afectado para diagnóstico.");
  console.log("2. Identificar el backup/dump/PITR anterior y probar la restauración en otra base.");
  console.log("3. Preferir una migración correctiva hacia adelante si el esquema sigue siendo recuperable.");
  console.log("4. Si se restaura, validar integridad, FKs, conteos y smoke tests antes de cambiar la URL.");
  console.log("5. Registrar operador, tiempos, checksum, evidencia y decisión final.");
  if (!hasReviewedSql) {
    console.log("");
    console.log("No se ejecutó nada: esta migración no tiene compensation.sql revisado.");
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
