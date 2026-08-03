import "dotenv/config";
import { createClient } from "@libsql/client";

const databaseUrl = process.env.DATABASE_URL || "file:./dev.db";

if (!databaseUrl.startsWith("file:")) {
  throw new Error(
    "El diagnóstico de ratings sólo admite una SQLite local (DATABASE_URL=file:...).",
  );
}

async function main(): Promise<void> {
  const client = createClient({ url: databaseUrl });

  try {
  const [summary, duplicateGroups, invalidValues, orphanUsers, orphanItems, indexes] =
    await Promise.all([
      client.execute(`
        SELECT
          COUNT(*) AS totalRows,
          COUNT(DISTINCT userId || char(0) || musicItemId) AS uniquePairs,
          COUNT(*) - COUNT(DISTINCT userId || char(0) || musicItemId) AS redundantRows,
          MIN(createdAt) AS earliestCreatedAt,
          MAX(updatedAt) AS latestUpdatedAt
        FROM Rating
      `),
      client.execute(`
        SELECT userId, musicItemId, COUNT(*) AS rowCount,
               MIN(createdAt) AS earliestCreatedAt, MAX(updatedAt) AS latestUpdatedAt
        FROM Rating
        GROUP BY userId, musicItemId
        HAVING COUNT(*) > 1
        ORDER BY rowCount DESC, userId, musicItemId
      `),
      client.execute(`
        SELECT id, value, userId, musicItemId, createdAt, updatedAt
        FROM Rating
        WHERE julianday(createdAt) IS NULL
           OR julianday(updatedAt) IS NULL
           OR typeof(value) NOT IN ('integer', 'real')
           OR value < 0.5
           OR value > 5
           OR abs((value * 2) - round(value * 2)) > 0.000000001
        ORDER BY id
      `),
      client.execute(`
        SELECT COUNT(*) AS count
        FROM Rating AS r
        LEFT JOIN User AS u ON u.id = r.userId
        WHERE u.id IS NULL
      `),
      client.execute(`
        SELECT COUNT(*) AS count
        FROM Rating AS r
        LEFT JOIN MusicItem AS m ON m.id = r.musicItemId
        WHERE m.id IS NULL
      `),
      client.execute(`
        SELECT name, "unique", origin
        FROM pragma_index_list('Rating')
        ORDER BY name
      `),
    ]);

    console.log(
      JSON.stringify(
        {
          database: databaseUrl,
          summary: summary.rows[0] ?? {},
          duplicateGroups: duplicateGroups.rows,
          invalidValues: invalidValues.rows,
          orphanUsers: orphanUsers.rows[0]?.count ?? 0,
          orphanItems: orphanItems.rows[0]?.count ?? 0,
          indexes: indexes.rows,
        },
        null,
        2,
      ),
    );
  } finally {
    client.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error de diagnóstico: ${message}`);
  process.exitCode = 1;
});
