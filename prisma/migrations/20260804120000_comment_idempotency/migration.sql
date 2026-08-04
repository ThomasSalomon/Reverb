-- Existing comments remain NULL and are intentionally not deduplicated.
ALTER TABLE "Comment" ADD COLUMN "operationId" TEXT;

CREATE UNIQUE INDEX "Comment_userId_operationId_key"
ON "Comment"("userId", "operationId");

