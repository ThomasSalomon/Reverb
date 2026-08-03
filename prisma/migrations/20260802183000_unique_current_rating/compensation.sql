-- Schema-only compensation for RTM-DATA-004.
-- This does NOT restore rows removed by deterministic deduplication. Restore a
-- verified pre-migration snapshot when those rows must be recovered.
DROP INDEX "Rating_userId_musicItemId_key";

CREATE INDEX "Rating_userId_musicItemId_idx"
ON "Rating"("userId", "musicItemId");
