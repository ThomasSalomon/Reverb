import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { createClient, type Client } from "@libsql/client";
import type { PrismaClient } from "@prisma/client";

const TEST_SECRET = "test-only-diary-event-secret-with-enough-entropy";
const USER_A = { id: "diary-user-a", username: "alice" };
const USER_B = { id: "diary-user-b", username: "bob" };
const USER_C = { id: "diary-user-c", username: "carol" };
const USER_D = { id: "diary-user-d", username: "diana" };

type Context = {
  prisma: PrismaClient;
  seedClient: Client;
  signToken: typeof import("../src/utils/auth").signToken;
  post: typeof import("../src/app/api/diary/route").POST;
  get: typeof import("../src/app/api/diary/route").GET;
  patch: typeof import("../src/app/api/diary/[id]/route").PATCH;
  remove: typeof import("../src/app/api/diary/[id]/route").DELETE;
  getStats: typeof import("../src/services/diary").DiaryService.getStats;
};

function request(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  url: string,
  token?: string,
  body?: unknown,
  rawBody = false,
): Request {
  const headers = new Headers({
    "x-user-id": USER_B.id,
    "x-user-name": USER_B.username,
  });
  if (token) headers.set("cookie", `token=${token}`);
  if (body !== undefined) headers.set("content-type", "application/json");

  return new Request(url, {
    method,
    headers,
    body: body === undefined
      ? undefined
      : rawBody
        ? String(body)
        : JSON.stringify(body),
  });
}

async function setup(): Promise<Context> {
  const dbUrl = "file::memory:?cache=shared";
  process.env.JWT_SECRET = TEST_SECRET;
  process.env.DATABASE_URL = dbUrl;
  process.env.TURSO_DATABASE_URL = dbUrl;
  delete process.env.TURSO_AUTH_TOKEN;

  const seedClient = createClient({ url: dbUrl });
  const baseline = await readFile(
    resolve("prisma/migrations/00000000000000_baseline/migration.sql"),
    "utf8",
  );
  await seedClient.executeMultiple(`PRAGMA foreign_keys = ON;\n${baseline}`);

  for (const user of [USER_A, USER_B, USER_C, USER_D]) {
    await seedClient.execute({
      sql: 'INSERT INTO "User" (id, username, email, password, updatedAt) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
      args: [user.id, user.username, `${user.username}@example.test`, "hash"],
    });
  }
  await seedClient.batch([
    {
      sql: 'INSERT INTO "MusicItem" (id, title, artist, type, coverUrl, releaseYear) VALUES (?, ?, ?, ?, ?, ?)',
      args: ["album-1", "First Album", "Artist A", "ALBUM", "https://example.test/a.jpg", 2020],
    },
    {
      sql: 'INSERT INTO "MusicItem" (id, title, artist, type, coverUrl, releaseYear) VALUES (?, ?, ?, ?, ?, ?)',
      args: ["album-2", "Second Album", "Artist B", "ALBUM", "https://example.test/b.jpg", 2021],
    },
    {
      sql: 'INSERT INTO "MusicItem" (id, title, artist, type, coverUrl, releaseYear) VALUES (?, ?, ?, ?, ?, ?)',
      args: ["song-1", "First Song", "Artist C", "SONG", "https://example.test/c.jpg", 2022],
    },
    {
      sql: 'INSERT INTO "MusicItem" (id, title, artist, type, coverUrl, releaseYear) VALUES (?, ?, ?, ?, ?, ?)',
      args: ["artist-1", "Not a playable item", "Artist D", "ARTIST", "https://example.test/d.jpg", 2023],
    },
  ]);
  await seedClient.execute({
    sql: `INSERT INTO "DiaryLog"
      (id, listenedAt, ratingValue, notes, userId, musicItemId, listenCount)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      "legacy-known-event",
      "2025-01-01T12:00:00.000Z",
      3.5,
      "Only the latest historical detail survived",
      USER_A.id,
      "album-2",
      3,
    ],
  });

  const auth = await import("../src/utils/auth");
  const diaryRoute = await import("../src/app/api/diary/route");
  const diaryItemRoute = await import("../src/app/api/diary/[id]/route");
  const diaryService = await import("../src/services/diary");
  const { prisma } = await import("../src/services/db");

  return {
    prisma,
    seedClient,
    signToken: auth.signToken,
    post: diaryRoute.POST,
    get: diaryRoute.GET,
    patch: diaryItemRoute.PATCH,
    remove: diaryItemRoute.DELETE,
    getStats: diaryService.DiaryService.getStats,
  };
}

async function json(response: Response): Promise<any> {
  return response.json();
}

test("diary rows are independent historical listening events", async (t) => {
  const context = await setup();
  const tokens = {
    alice: await context.signToken({ userId: USER_A.id, username: USER_A.username }),
    bob: await context.signToken({ userId: USER_B.id, username: USER_B.username }),
    carol: await context.signToken({ userId: USER_C.id, username: USER_C.username }),
    diana: await context.signToken({ userId: USER_D.id, username: USER_D.username }),
  };

  try {
    await t.test("repeated POSTs preserve every event and return a stable full history", async () => {
      const firstResponse = await context.post(request(
        "POST",
        "http://localhost/api/diary",
        tokens.alice,
        {
          musicItemId: "album-1",
          listenedAt: "2026-01-02T10:00:00.000Z",
          ratingValue: 4,
          notes: "First listen",
          userId: USER_B.id,
        },
      ));
      const secondResponse = await context.post(request(
        "POST",
        "http://localhost/api/diary",
        tokens.alice,
        {
          musicItemId: "album-1",
          listenedAt: "2026-02-02T10:00:00.000Z",
          ratingValue: 4.5,
          notes: "Second listen",
        },
      ));
      const sameDateResponse = await context.post(request(
        "POST",
        "http://localhost/api/diary",
        tokens.alice,
        {
          musicItemId: "album-1",
          listenedAt: "2026-02-02T10:00:00.000Z",
          ratingValue: 4.5,
          notes: "",
        },
      ));

      assert.deepEqual(
        [firstResponse.status, secondResponse.status, sameDateResponse.status],
        [201, 201, 201],
      );
      const [first, second, sameDate] = await Promise.all([
        json(firstResponse),
        json(secondResponse),
        json(sameDateResponse),
      ]);
      assert.equal(new Set([first.id, second.id, sameDate.id]).size, 3);
      assert.deepEqual(
        [first.notes, first.ratingValue, first.listenedAt],
        ["First listen", 4, "2026-01-02T10:00:00.000Z"],
      );
      assert.deepEqual(
        [second.notes, second.ratingValue, second.listenedAt],
        ["Second listen", 4.5, "2026-02-02T10:00:00.000Z"],
      );
      assert.equal(sameDate.notes, null);
      assert.equal(first.listenCount, 1);
      assert.ok(!("userId" in first));

      const legacy = await context.prisma.diaryLog.findUnique({
        where: { id: "legacy-known-event" },
      });
      assert.equal(legacy?.listenCount, 3);
      assert.equal(legacy?.notes, "Only the latest historical detail survived");

      const firstRead = await context.get(
        request("GET", "http://localhost/api/diary?username=alice"),
      );
      const secondRead = await context.get(
        request("GET", "http://localhost/api/diary?username=alice"),
      );
      assert.equal(firstRead.status, 200);
      const firstHistory = await json(firstRead);
      const secondHistory = await json(secondRead);
      assert.deepEqual(
        firstHistory.map((entry: any) => entry.id),
        secondHistory.map((entry: any) => entry.id),
      );
      assert.equal(firstHistory.filter((entry: any) => entry.musicItemId === "album-1").length, 3);

      for (let index = 1; index < firstHistory.length; index += 1) {
        const previous = firstHistory[index - 1];
        const current = firstHistory[index];
        const previousKey = [previous.listenedAt, previous.createdAt, previous.id];
        const currentKey = [current.listenedAt, current.createdAt, current.id];
        assert.ok(
          previousKey[0] > currentKey[0] ||
          (previousKey[0] === currentKey[0] && previousKey[1] > currentKey[1]) ||
          (previousKey[0] === currentKey[0] && previousKey[1] === currentKey[1] && previousKey[2] >= currentKey[2]),
        );
      }
    });

    await t.test("two concurrent valid writes persist two events", async () => {
      const before = await context.prisma.diaryLog.count({ where: { userId: USER_C.id } });
      const responses = await Promise.all([
        context.post(request("POST", "http://localhost/api/diary", tokens.carol, {
          musicItemId: "album-1",
          listenedAt: "2026-03-01T09:00:00.000Z",
          ratingValue: 5,
          notes: "Concurrent A",
        })),
        context.post(request("POST", "http://localhost/api/diary", tokens.carol, {
          musicItemId: "album-1",
          listenedAt: "2026-03-01T09:00:00.000Z",
          ratingValue: 5,
          notes: "Concurrent B",
        })),
      ]);
      assert.deepEqual(responses.map((response) => response.status), [201, 201]);
      const payloads = await Promise.all(responses.map(json));
      assert.notEqual(payloads[0].id, payloads[1].id);
      assert.equal(
        await context.prisma.diaryLog.count({ where: { userId: USER_C.id } }),
        before + 2,
      );
    });

    await t.test("PATCH and DELETE target one owned event without horizontal access", async () => {
      const createResponse = await context.post(request(
        "POST",
        "http://localhost/api/diary",
        tokens.alice,
        { musicItemId: "song-1", ratingValue: 2.5, notes: "Original" },
      ));
      const created = await json(createResponse);

      const foreignPatch = await context.patch(
        request("PATCH", `http://localhost/api/diary/${created.id}`, tokens.bob, { notes: "Forged" }),
        { params: { id: created.id } },
      );
      assert.equal(foreignPatch.status, 404);

      const ownPatch = await context.patch(
        request("PATCH", `http://localhost/api/diary/${created.id}`, tokens.alice, {
          listenedAt: "2026-04-01T12:30:00.000Z",
          ratingValue: 3,
          notes: "Edited",
          musicItemId: "album-2",
        }),
        { params: { id: created.id } },
      );
      assert.equal(ownPatch.status, 200);
      const updated = await json(ownPatch);
      assert.deepEqual(
        [updated.musicItemId, updated.ratingValue, updated.notes, updated.listenCount],
        ["song-1", 3, "Edited", 1],
      );

      const foreignDelete = await context.remove(
        request("DELETE", `http://localhost/api/diary/${created.id}`, tokens.bob),
        { params: { id: created.id } },
      );
      assert.equal(foreignDelete.status, 404);
      assert.equal(await context.prisma.diaryLog.count({ where: { id: created.id } }), 1);

      const anonymousDelete = await context.remove(
        request("DELETE", `http://localhost/api/diary/${created.id}`),
        { params: { id: created.id } },
      );
      assert.equal(anonymousDelete.status, 401);

      const ownDelete = await context.remove(
        request("DELETE", `http://localhost/api/diary/${created.id}`, tokens.alice),
        { params: { id: created.id } },
      );
      assert.equal(ownDelete.status, 204);
      assert.equal(await context.prisma.diaryLog.count({ where: { id: created.id } }), 0);
    });

    await t.test("the HTTP boundary rejects malformed and invalid events without writes", async () => {
      const before = await context.prisma.diaryLog.count({ where: { userId: USER_B.id } });
      const invalidBodies = [
        {},
        { musicItemId: 123, ratingValue: 4 },
        { musicItemId: "album-1", listenedAt: "not-a-date", ratingValue: 4 },
        { musicItemId: "album-1", listenedAt: "2026-02-30", ratingValue: 4 },
        { musicItemId: "album-1", listenedAt: "2026-02-30T10:00:00.000Z", ratingValue: 4 },
        { musicItemId: "album-1", listenedAt: 1785686400000, ratingValue: 4 },
        { musicItemId: "album-1", ratingValue: 0 },
        { musicItemId: "album-1", ratingValue: 5.25 },
        { musicItemId: "album-1", ratingValue: 6 },
        { musicItemId: "album-1", notes: { text: "invalid" } },
        { musicItemId: "album-1", notes: "x".repeat(501) },
        { musicItemId: "artist-1", ratingValue: 4 },
      ];
      for (const body of invalidBodies) {
        const response = await context.post(
          request("POST", "http://localhost/api/diary", tokens.bob, body),
        );
        assert.equal(response.status, 400, JSON.stringify(body).slice(0, 100));
      }

      const malformed = await context.post(
        request("POST", "http://localhost/api/diary", tokens.bob, "{", true),
      );
      assert.equal(malformed.status, 400);
      const tooLarge = await context.post(
        request("POST", "http://localhost/api/diary", tokens.bob, {
          musicItemId: "album-1",
          notes: "x".repeat(17 * 1024),
        }),
      );
      assert.equal(tooLarge.status, 413);

      const originalFetch = globalThis.fetch;
      const originalConsoleError = console.error;
      globalThis.fetch = async () => new Response(
        JSON.stringify({ error: { message: "missing" } }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
      console.error = () => undefined;
      try {
        const missing = await context.post(
          request("POST", "http://localhost/api/diary", tokens.bob, {
            musicItemId: "missing-catalog-item",
            ratingValue: 4,
          }),
        );
        assert.equal(missing.status, 404);
      } finally {
        globalThis.fetch = originalFetch;
        console.error = originalConsoleError;
      }

      const anonymous = await context.post(
        request("POST", "http://localhost/api/diary", undefined, {
          musicItemId: "album-1",
          ratingValue: 4,
        }),
      );
      const invalidToken = await context.post(
        request("POST", "http://localhost/api/diary", "not-a-token", {
          musicItemId: "album-1",
          ratingValue: 4,
        }),
      );
      assert.deepEqual([anonymous.status, invalidToken.status], [401, 401]);
      assert.equal(await context.prisma.diaryLog.count({ where: { userId: USER_B.id } }), before);
    });

    await t.test("statistics distinguish event rows, known listens, unique items and latest listen", async () => {
      const older = await context.post(request(
        "POST",
        "http://localhost/api/diary",
        tokens.diana,
        {
          musicItemId: "album-1",
          listenedAt: "2026-05-01T10:00:00.000Z",
          ratingValue: null,
          notes: null,
        },
      ));
      const newer = await context.post(request(
        "POST",
        "http://localhost/api/diary",
        tokens.diana,
        {
          musicItemId: "album-1",
          listenedAt: "2026-05-02T10:00:00.000Z",
          ratingValue: 5,
          notes: "Again",
        },
      ));
      assert.deepEqual([older.status, newer.status], [201, 201]);
      const newerEvent = await json(newer);

      const stats = await context.getStats(USER_D.id);
      assert.deepEqual(
        [stats.diaryEntries, stats.totalListens, stats.uniqueListenedItems],
        [2, 2, 1],
      );
      assert.equal(stats.latestListen?.id, newerEvent.id);

      const legacyStats = await context.getStats(USER_A.id);
      const aliceRows = await context.prisma.diaryLog.findMany({
        where: { userId: USER_A.id },
        select: { listenCount: true },
      });
      assert.equal(
        legacyStats.totalListens,
        aliceRows.reduce((sum, row) => sum + row.listenCount, 0),
      );
    });
  } finally {
    await context.prisma.$disconnect();
    context.seedClient.close();
  }
});
