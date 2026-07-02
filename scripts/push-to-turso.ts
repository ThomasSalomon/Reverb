import "dotenv/config";
import { execSync } from "child_process";
import { createClient } from "@libsql/client";

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    console.error("Error: TURSO_DATABASE_URL is not set in your .env file.");
    process.exit(1);
  }

  console.log("Generating SQL migration script from Prisma schema...");
  let sqlScript: string;
  try {
    sqlScript = execSync(
      "npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script",
      { encoding: "utf-8" }
    );
  } catch (e) {
    console.error("Failed to generate SQL migration script:", e);
    process.exit(1);
  }

  console.log(`Connecting to Turso database at ${url}...`);
  const client = createClient({
    url,
    authToken,
  });

  console.log("Applying schema to Turso database...");
  try {
    await client.executeMultiple(sqlScript);
    console.log("Success! Schema applied successfully to your Turso database.");
  } catch (e) {
    console.error("Failed to apply schema to Turso database:", e);
    process.exit(1);
  } finally {
    client.close();
  }
}

main();
