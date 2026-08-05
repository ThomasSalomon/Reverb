-- RTM-SEC-005: server-side records for individually revocable JWT sessions.
-- Existing JWTs do not have a session identifier and are intentionally rejected by
-- the application after this migration; no user data is altered or removed.
ALTER TABLE "User" ADD COLUMN "credentialsVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "credentialsVersion" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    CONSTRAINT "AuthSession_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Point lookups use the primary key. This index supports revoking a user's active
-- sessions on a password change without scanning sessions from other users.
CREATE INDEX "AuthSession_userId_revokedAt_idx" ON "AuthSession"("userId", "revokedAt");
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");
