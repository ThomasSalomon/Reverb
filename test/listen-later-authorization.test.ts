import assert from "node:assert/strict";
import test from "node:test";
import { createClient, type Client } from "@libsql/client";
import type { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";

const USER_A_ID = "listen-user-a";
const USER_B_ID = "listen-user-b";
const TEST_SECRET = "test-only-listen-later-authorization-secret";

type TestContext = {
  prisma: PrismaClient;
  seedClient: Client;
  signToken: typeof import("../src/utils/auth").signToken;
  getListenLater: typeof import("../src/app/api/listen-later/route").GET;
  postListenLater: typeof import("../src/app/api/listen-later/route").POST;
  deleteListenLater: typeof import("../src/app/api/listen-later/[musicItemId]/route").DELETE;
};

function request(
  method: "GET" | "POST" | "DELETE",
  url: string,
  token?: string,
  body?: Record<string, unknown>,
): Request {
  const headers = new Headers({
    "x-user-id": USER_B_ID,
    "x-user-name": "bob",
  });

  if (token) headers.set("cookie", `token=${token}`);
  if (body) headers.set("content-type", "application/json");

  return new Request(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function expiredToken(): Promise<string> {
  return new SignJWT({ userId: USER_A_ID, username: "alice" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1 second ago")
    .sign(new TextEncoder().encode(TEST_SECRET));
}

async function setup(): Promise<TestContext> {
  const dbUrl = "file::memory:?cache=shared";
  process.env.JWT_SECRET = TEST_SECRET;
  process.env.TURSO_DATABASE_URL = dbUrl;
  process.env.DATABASE_URL = dbUrl;
  delete process.env.TURSO_AUTH_TOKEN;

  const seedClient = createClient({ url: dbUrl });
  await seedClient.executeMultiple(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE "User" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "username" TEXT NOT NULL UNIQUE,
      "email" TEXT NOT NULL UNIQUE,
      "password" TEXT NOT NULL,
      "bio" TEXT,
      "favoriteGenre" TEXT,
      "profileImage" TEXT,
      "profileColor" TEXT DEFAULT 'emerald',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
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

    CREATE TABLE "ListenLater" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "userId" TEXT NOT NULL,
      "musicItemId" TEXT NOT NULL,
      FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      FOREIGN KEY ("musicItemId") REFERENCES "MusicItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE UNIQUE INDEX "ListenLater_userId_musicItemId_key"
      ON "ListenLater" ("userId", "musicItemId");

    INSERT INTO "User" ("id", "username", "email", "password", "updatedAt")
      VALUES ('${USER_A_ID}', 'alice', 'alice-listen@example.test', 'hash', CURRENT_TIMESTAMP);
    INSERT INTO "User" ("id", "username", "email", "password", "updatedAt")
      VALUES ('${USER_B_ID}', 'bob', 'bob-listen@example.test', 'hash', CURRENT_TIMESTAMP);

    INSERT INTO "MusicItem" ("id", "title", "artist", "type", "coverUrl", "releaseYear") VALUES
      ('a-existing', 'Alice Album', 'Artist A', 'ALBUM', 'https://example.test/a.jpg', 2020),
      ('b-private', 'Bob Private Album', 'Artist B', 'ALBUM', 'https://example.test/b.jpg', 2021),
      ('shared-item', 'Shared Album', 'Artist S', 'ALBUM', 'https://example.test/s.jpg', 2022),
      ('new-item', 'New Album', 'Artist N', 'ALBUM', 'https://example.test/n.jpg', 2023);

    INSERT INTO "ListenLater" ("id", "userId", "musicItemId") VALUES
      ('a-listen-1', '${USER_A_ID}', 'a-existing'),
      ('a-listen-shared', '${USER_A_ID}', 'shared-item'),
      ('b-listen-1', '${USER_B_ID}', 'b-private'),
      ('b-listen-shared', '${USER_B_ID}', 'shared-item');
  `);

  const auth = await import("../src/utils/auth");
  const listenLaterRoute = await import("../src/app/api/listen-later/route");
  const listenLaterItemRoute = await import("../src/app/api/listen-later/[musicItemId]/route");
  const { prisma } = await import("../src/services/db");

  return {
    prisma,
    seedClient,
    signToken: auth.signToken,
    getListenLater: listenLaterRoute.GET,
    postListenLater: listenLaterRoute.POST,
    deleteListenLater: listenLaterItemRoute.DELETE,
  };
}

function musicItemIds(payload: unknown): string[] {
  assert.ok(Array.isArray(payload));
  return payload.map((entry) => entry.musicItemId).sort();
}

test("listen-later is private to the authenticated owner across reads and writes", async (t) => {
  const context = await setup();
  const tokenA = await context.signToken({ userId: USER_A_ID, username: "alice" });

  try {
    await t.test("anonymous and invalid sessions receive no private data", async () => {
      const before = await context.prisma.listenLater.count();
      const responses = await Promise.all([
        context.getListenLater(
          request("GET", "http://localhost/api/listen-later?username=bob&userId=listen-user-b"),
        ),
        context.getListenLater(
          request("GET", "http://localhost/api/listen-later?username=bob", "not-a-jwt"),
        ),
        context.getListenLater(
          request("GET", "http://localhost/api/listen-later?username=bob", await expiredToken()),
        ),
      ]);

      for (const response of responses) {
        assert.equal(response.status, 401);
        assert.deepEqual(await response.json(), { error: "No autenticado" });
      }
      assert.equal(await context.prisma.listenLater.count(), before);
    });

    await t.test("the owner receives only the minimal representation of their own items", async () => {
      const response = await context.getListenLater(
        request("GET", "http://localhost/api/listen-later", tokenA),
      );
      assert.equal(response.status, 200);

      const payload = await response.json();
      assert.deepEqual(musicItemIds(payload), ["a-existing", "shared-item"]);
      for (const entry of payload) {
        assert.deepEqual(Object.keys(entry).sort(), ["musicItem", "musicItemId"]);
        assert.deepEqual(
          Object.keys(entry.musicItem).sort(),
          ["artist", "coverUrl", "id", "title"],
        );
      }
      assert.doesNotMatch(JSON.stringify(payload), /Bob Private Album|b-private|listen-user-b/);
    });

    await t.test("client-controlled identities cannot replace the authenticated actor", async () => {
      const hostileUrls = [
        "http://localhost/api/listen-later?username=bob",
        "http://localhost/api/listen-later?username=Bob",
        "http://localhost/api/listen-later?username=missing-user",
        `http://localhost/api/listen-later?userId=${USER_B_ID}`,
      ];

      for (const url of hostileUrls) {
        const response = await context.getListenLater(request("GET", url, tokenA));
        assert.equal(response.status, 200);
        const payload = await response.json();
        assert.deepEqual(musicItemIds(payload), ["a-existing", "shared-item"]);
        assert.doesNotMatch(JSON.stringify(payload), /Bob Private Album|b-private|listen-user-b/);
      }
    });

    await t.test("writes use the session owner and preserve idempotency", async () => {
      const anonymous = await context.postListenLater(
        request("POST", "http://localhost/api/listen-later", undefined, {
          musicItemId: "new-item",
          userId: USER_B_ID,
          username: "bob",
        }),
      );
      assert.equal(anonymous.status, 401);

      const expired = await context.postListenLater(
        request("POST", "http://localhost/api/listen-later", await expiredToken(), {
          musicItemId: "new-item",
          userId: USER_B_ID,
        }),
      );
      assert.equal(expired.status, 401);
      assert.equal(
        await context.prisma.listenLater.count({ where: { musicItemId: "new-item" } }),
        0,
      );

      for (let attempt = 0; attempt < 2; attempt += 1) {
        const response = await context.postListenLater(
          request("POST", "http://localhost/api/listen-later", tokenA, {
            musicItemId: "new-item",
            userId: USER_B_ID,
            username: "bob",
          }),
        );
        assert.equal(response.status, 201);
      }

      const inserted = await context.prisma.listenLater.findMany({
        where: { musicItemId: "new-item" },
        select: { userId: true },
      });
      assert.deepEqual(inserted, [{ userId: USER_A_ID }]);
    });

    await t.test("deletes are scoped to the owner and do not enumerate third-party records", async () => {
      const invalidSession = await context.deleteListenLater(
        request("DELETE", "http://localhost/api/listen-later/b-private", "not-a-jwt"),
        { params: { musicItemId: "b-private" } },
      );
      assert.equal(invalidSession.status, 401);

      const foreignResponse = await context.deleteListenLater(
        request("DELETE", "http://localhost/api/listen-later/b-private", tokenA),
        { params: { musicItemId: "b-private" } },
      );
      const missingResponse = await context.deleteListenLater(
        request("DELETE", "http://localhost/api/listen-later/missing-item", tokenA),
        { params: { musicItemId: "missing-item" } },
      );

      assert.equal(foreignResponse.status, 200);
      assert.equal(missingResponse.status, 200);
      assert.deepEqual(await foreignResponse.json(), await missingResponse.json());
      assert.equal(
        await context.prisma.listenLater.count({
          where: { userId: USER_B_ID, musicItemId: "b-private" },
        }),
        1,
      );

      const ownDelete = await context.deleteListenLater(
        request("DELETE", "http://localhost/api/listen-later/shared-item", tokenA),
        { params: { musicItemId: "shared-item" } },
      );
      assert.equal(ownDelete.status, 200);
      assert.equal(
        await context.prisma.listenLater.count({
          where: { userId: USER_A_ID, musicItemId: "shared-item" },
        }),
        0,
      );
      assert.equal(
        await context.prisma.listenLater.count({
          where: { userId: USER_B_ID, musicItemId: "shared-item" },
        }),
        1,
      );
    });
  } finally {
    await context.prisma.$disconnect();
    context.seedClient.close();
  }
});
