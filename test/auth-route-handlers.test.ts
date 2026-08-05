import assert from "node:assert/strict";
import test from "node:test";
import { createClient, type Client } from "@libsql/client";
import type { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";

const USER_A_ID = "user-a";
const USER_B_ID = "user-b";
const MUSIC_ITEM_ID = "album-1";
const TEST_SECRET = "test-only-secret-with-enough-entropy-for-auth-tests";

type TestContext = {
  prisma: PrismaClient;
  seedClient: Client;
  resolveAuthUser: typeof import("../src/utils/auth").resolveAuthUser;
  signToken: typeof import("../src/utils/auth").signToken;
  postRating: typeof import("../src/app/api/ratings/route").POST;
  postReview: typeof import("../src/app/api/reviews/route").POST;
};

function requestFor(body: Record<string, unknown>, token?: string): Request {
  const headers = new Headers({
    "content-type": "application/json",
    "x-user-id": USER_B_ID,
    "x-user-name": "bob",
  });

  if (token) {
    headers.set("cookie", `token=${token}`);
  }

  return new Request("http://localhost/api/protected", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

async function createSignedToken(
  payload: Record<string, unknown>,
  secret = TEST_SECRET,
  expiration = "1h",
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiration)
    .sign(new TextEncoder().encode(secret));
}

async function setup(): Promise<TestContext> {
  const dbUrl = "file::memory:?cache=shared";

  process.env.JWT_SECRET = TEST_SECRET;
  process.env.TURSO_DATABASE_URL = dbUrl;
  process.env.DATABASE_URL = dbUrl;
  delete process.env.TURSO_AUTH_TOKEN;

  const client = createClient({ url: dbUrl });
  await client.executeMultiple(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE "User" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "username" TEXT NOT NULL UNIQUE,
      "email" TEXT NOT NULL UNIQUE,
      "password" TEXT NOT NULL,
      "credentialsVersion" INTEGER NOT NULL DEFAULT 0,
      "bio" TEXT,
      "favoriteGenre" TEXT,
      "profileImage" TEXT,
      "profileColor" TEXT DEFAULT 'emerald',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    );

    CREATE TABLE "AuthSession" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "credentialsVersion" INTEGER NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "expiresAt" DATETIME NOT NULL,
      "revokedAt" DATETIME,
      FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE TABLE "MusicItem" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "title" TEXT NOT NULL,
      "artist" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "coverUrl" TEXT NOT NULL,
      "releaseYear" INTEGER NOT NULL,
      "tracks" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE "Review" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "content" TEXT NOT NULL,
      "ratingValue" REAL NOT NULL,
      "tags" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      "userId" TEXT NOT NULL,
      "musicItemId" TEXT NOT NULL,
      FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      FOREIGN KEY ("musicItemId") REFERENCES "MusicItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE TABLE "Rating" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "value" REAL NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      "userId" TEXT NOT NULL,
      "musicItemId" TEXT NOT NULL,
      FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      FOREIGN KEY ("musicItemId") REFERENCES "MusicItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE UNIQUE INDEX "Rating_userId_musicItemId_key"
      ON "Rating" ("userId", "musicItemId");

    CREATE TABLE "EarnedBadge" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "badgeId" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "userId" TEXT NOT NULL,
      FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE UNIQUE INDEX "EarnedBadge_userId_badgeId_key"
      ON "EarnedBadge" ("userId", "badgeId");

    CREATE TABLE "Notification" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "type" TEXT NOT NULL,
      "message" TEXT NOT NULL,
      "isRead" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "userId" TEXT NOT NULL,
      "sourceUserId" TEXT,
      "link" TEXT,
      FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );

    INSERT INTO "User" ("id", "username", "email", "password", "updatedAt")
      VALUES ('${USER_A_ID}', 'alice', 'alice@example.test', 'hash', CURRENT_TIMESTAMP);
    INSERT INTO "User" ("id", "username", "email", "password", "updatedAt")
      VALUES ('${USER_B_ID}', 'bob', 'bob@example.test', 'hash', CURRENT_TIMESTAMP);
    INSERT INTO "MusicItem" ("id", "title", "artist", "type", "coverUrl", "releaseYear")
      VALUES ('${MUSIC_ITEM_ID}', 'Test Album', 'Test Artist', 'ALBUM', 'https://example.test/cover.jpg', 2026);
    INSERT INTO "Review" ("id", "content", "ratingValue", "updatedAt", "userId", "musicItemId")
      VALUES ('existing-review', 'Existing review', 4.0, CURRENT_TIMESTAMP, '${USER_A_ID}', '${MUSIC_ITEM_ID}');
  `);
  const auth = await import("../src/utils/auth");
  const ratingsRoute = await import("../src/app/api/ratings/route");
  const reviewsRoute = await import("../src/app/api/reviews/route");
  const { prisma } = await import("../src/services/db");

  return {
    prisma,
    seedClient: client,
    resolveAuthUser: auth.resolveAuthUser,
    signToken: auth.signToken,
    postRating: ratingsRoute.POST,
    postReview: reviewsRoute.POST,
  };
}

test("protected review and rating handlers derive their actor from the verified session cookie", async (t) => {
  const context = await setup();

  try {
    await t.test("authentication reports missing, malformed, expired, and incomplete sessions explicitly", async () => {
      const malformed = await context.resolveAuthUser(requestFor({}));
      assert.deepEqual(malformed, { ok: false, reason: "missing" });

      const invalid = await context.resolveAuthUser(requestFor({}, "not-a-jwt"));
      assert.deepEqual(invalid, { ok: false, reason: "invalid" });

      const expiredToken = await createSignedToken(
        { userId: USER_A_ID, username: "alice", sessionId: "expired", credentialsVersion: 0 },
        TEST_SECRET,
        "1 second ago",
      );
      const expired = await context.resolveAuthUser(requestFor({}, expiredToken));
      assert.deepEqual(expired, { ok: false, reason: "expired" });

      const incompleteToken = await createSignedToken({ userId: USER_A_ID, sessionId: "missing-claims", credentialsVersion: 0 });
      const incomplete = await context.resolveAuthUser(requestFor({}, incompleteToken));
      assert.deepEqual(incomplete, { ok: false, reason: "invalid" });

      const tokenWithoutExpiration = await new SignJWT({
        userId: USER_A_ID,
        username: "alice",
        sessionId: "without-expiration",
        credentialsVersion: 0,
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .sign(new TextEncoder().encode(TEST_SECRET));
      const missingExpiration = await context.resolveAuthUser(
        requestFor({}, tokenWithoutExpiration),
      );
      assert.deepEqual(missingExpiration, { ok: false, reason: "invalid" });
    });

    await t.test("direct handler calls reject missing, malformed, invalid-signature, and expired tokens without writes", async () => {
      const before = await Promise.all([
        context.prisma.review.count(),
        context.prisma.rating.count(),
      ]);
      const invalidSignature = await createSignedToken(
        { userId: USER_A_ID, username: "alice", sessionId: "bad-signature", credentialsVersion: 0 },
        "different-test-secret",
      );
      const expired = await createSignedToken(
        { userId: USER_A_ID, username: "alice", sessionId: "expired-write", credentialsVersion: 0 },
        TEST_SECRET,
        "1 second ago",
      );

      const attempts = [
        context.postReview(requestFor({ musicItemId: MUSIC_ITEM_ID, content: "No session", ratingValue: 4 })),
        context.postRating(requestFor({ musicItemId: MUSIC_ITEM_ID, value: 4 }, "not-a-jwt")),
        context.postRating(requestFor({ musicItemId: MUSIC_ITEM_ID, value: 4 }, invalidSignature)),
        context.postReview(requestFor({ musicItemId: MUSIC_ITEM_ID, content: "Expired", ratingValue: 4 }, expired)),
      ];
      const responses = await Promise.all(attempts);

      assert.deepEqual(responses.map((response) => response.status), [401, 401, 401, 401]);

      const after = await Promise.all([
        context.prisma.review.count(),
        context.prisma.rating.count(),
      ]);
      assert.deepEqual(after, before);
    });

    await t.test("a valid session for user A overrides forged identity in headers", async () => {
      const token = await context.signToken({ userId: USER_A_ID, username: "alice" });

      const reviewResponse = await context.postReview(
        requestFor(
          {
            musicItemId: MUSIC_ITEM_ID,
            content: "Authenticated review",
            ratingValue: 4,
            tags: ["happy"],
          },
          token,
        ),
      );
      assert.equal(reviewResponse.status, 200);

      const reviewRows = await context.prisma.review.findMany({
        where: { content: "Authenticated review" },
        select: { userId: true },
      });
      assert.deepEqual(reviewRows.map((row) => row.userId), [USER_A_ID]);

      const ratingResponse = await context.postRating(
        requestFor({ musicItemId: MUSIC_ITEM_ID, value: 4.5 }, token),
      );
      assert.equal(ratingResponse.status, 200);

      const ratingRows = await context.prisma.rating.findMany({
        where: { musicItemId: MUSIC_ITEM_ID },
        select: { userId: true, value: true },
      });
      assert.equal(ratingRows.length, 1);
      assert.equal(ratingRows[0].userId, USER_A_ID);
      assert.equal(ratingRows[0].value, 4.5);
    });
  } finally {
    await context.prisma.$disconnect();
    context.seedClient.close();
  }
});
