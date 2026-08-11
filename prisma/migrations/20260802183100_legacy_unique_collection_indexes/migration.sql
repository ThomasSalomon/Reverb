-- RTM-OPS-012: reconcile two unique indexes accidentally created by the
-- pre-ledger Turso deployment. Dropping an index never deletes table rows;
-- the canonical non-unique lookup indexes are restored immediately.
DROP INDEX IF EXISTS "DiaryLog_userId_musicItemId_key";
DROP INDEX IF EXISTS "Review_userId_musicItemId_key";

CREATE INDEX IF NOT EXISTS "DiaryLog_userId_musicItemId_idx"
ON "DiaryLog"("userId", "musicItemId");

CREATE INDEX IF NOT EXISTS "Review_userId_musicItemId_idx"
ON "Review"("userId", "musicItemId");
