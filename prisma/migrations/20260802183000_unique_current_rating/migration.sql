-- RTM-DATA-004: Rating stores the current value, so one user can have at most
-- one row per music item. Operators must record the pre/post counts produced by
-- `npm run db:ratings:diagnose` before applying this migration to a real copy.

-- Abort before deleting anything when rows cannot be ordered safely, violate
-- the supported rating range, or have broken required relationships.
CREATE TABLE "_RatingDeduplicationGuard" (
    "valid" INTEGER NOT NULL CHECK ("valid" = 1)
);

INSERT INTO "_RatingDeduplicationGuard" ("valid")
SELECT CASE WHEN EXISTS (
    SELECT 1
    FROM "Rating" AS "r"
    LEFT JOIN "User" AS "u" ON "u"."id" = "r"."userId"
    LEFT JOIN "MusicItem" AS "m" ON "m"."id" = "r"."musicItemId"
    WHERE julianday("r"."createdAt") IS NULL
       OR julianday("r"."updatedAt") IS NULL
       OR typeof("r"."value") NOT IN ('integer', 'real')
       OR "r"."value" < 0.5
       OR "r"."value" > 5
       OR abs(("r"."value" * 2) - round("r"."value" * 2)) > 0.000000001
       OR "u"."id" IS NULL
       OR "m"."id" IS NULL
) THEN 0 ELSE 1 END;

DROP TABLE "_RatingDeduplicationGuard";

-- Keep the most recently updated row. Ties are resolved by creation time and
-- then by ID so the survivor is deterministic on SQLite/libSQL.
DELETE FROM "Rating"
WHERE "id" IN (
    SELECT "id"
    FROM (
        SELECT
            "id",
            ROW_NUMBER() OVER (
                PARTITION BY "userId", "musicItemId"
                ORDER BY
                    julianday("updatedAt") DESC,
                    "updatedAt" DESC,
                    julianday("createdAt") DESC,
                    "createdAt" DESC,
                    "id" DESC
            ) AS "duplicate_rank"
        FROM "Rating"
    ) AS "ranked_ratings"
    WHERE "duplicate_rank" > 1
);

DROP INDEX "Rating_userId_musicItemId_idx";

CREATE UNIQUE INDEX "Rating_userId_musicItemId_key"
ON "Rating"("userId", "musicItemId");
