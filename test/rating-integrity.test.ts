import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { createClient, type Client } from "@libsql/client";
import type { PrismaClient } from "@prisma/client";

const TEST_SECRET = "rating-integrity-test-secret-with-enough-entropy";
const USER_A_ID = "rating-user-a";
const USER_B_ID = "rating-user-b";
const ALBUM_A_ID = "rating-album-a";
const ALBUM_B_ID = "rating-album-b";

type Context = {
  client: Client;
  prisma: PrismaClient;
  postRating: typeof import("../src/app/api/ratings/route").POST;
  postReview: typeof import("../src/app/api/reviews/route").POST;
  patchReview: typeof import("../src/app/api/reviews/[id]/route").PATCH;
  deleteReview: typeof import("../src/app/api/reviews/[id]/route").DELETE;
  parseRatingValue: typeof import("../src/services/ratings").parseRatingValue;
  tokenA: string;
  tokenB: string;
};

function request(
  path: string,
  method: string,
  body: unknown,
  token?: string,
  rawBody?: string,
): Request {
  const headers = new Headers({ "content-type": "application/json" });
  if (token) headers.set("cookie", `token=${token}`);
  return new Request(`http://localhost${path}`, {
    method,
    headers,
    body: rawBody ?? JSON.stringify(body),
  });
}

async function setup(): Promise<Context> {
  const dbUrl = "file::memory:?cache=shared";
  process.env.JWT_SECRET = TEST_SECRET;
  process.env.DATABASE_URL = dbUrl;
  process.env.TURSO_DATABASE_URL = dbUrl;
  delete process.env.TURSO_AUTH_TOKEN;

  const client = createClient({ url: dbUrl });
  const migrationsRoot = resolve(import.meta.dirname, "..", "prisma", "migrations");
  for (const name of ["00000000000000_baseline", "20260802183000_unique_current_rating"]) {
    await client.executeMultiple(
      await readFile(resolve(migrationsRoot, name, "migration.sql"), "utf8"),
    );
  }
  await client.executeMultiple(`
    PRAGMA foreign_keys = ON;
    INSERT INTO "User" ("id", "username", "email", "password", "updatedAt") VALUES
      ('${USER_A_ID}', 'rating-alice', 'rating-alice@example.test', 'hash', CURRENT_TIMESTAMP),
      ('${USER_B_ID}', 'rating-bob', 'rating-bob@example.test', 'hash', CURRENT_TIMESTAMP);
    INSERT INTO "MusicItem" ("id", "title", "artist", "type", "coverUrl", "releaseYear") VALUES
      ('${ALBUM_A_ID}', 'Rating Album A', 'Test Artist', 'ALBUM', 'https://example.test/a.jpg', 2026),
      ('${ALBUM_B_ID}', 'Rating Album B', 'Test Artist', 'ALBUM', 'https://example.test/b.jpg', 2026);
  `);

  const auth = await import("../src/utils/auth");
  const ratingsRoute = await import("../src/app/api/ratings/route");
  const reviewsRoute = await import("../src/app/api/reviews/route");
  const reviewRoute = await import("../src/app/api/reviews/[id]/route");
  const ratingService = await import("../src/services/ratings");
  const { prisma } = await import("../src/services/db");

  return {
    client,
    prisma,
    postRating: ratingsRoute.POST,
    postReview: reviewsRoute.POST,
    patchReview: reviewRoute.PATCH,
    deleteReview: reviewRoute.DELETE,
    parseRatingValue: ratingService.parseRatingValue,
    tokenA: await auth.signToken({ userId: USER_A_ID, username: "rating-alice" }),
    tokenB: await auth.signToken({ userId: USER_B_ID, username: "rating-bob" }),
  };
}

async function reset(context: Context): Promise<void> {
  await context.prisma.notification.deleteMany();
  await context.prisma.earnedBadge.deleteMany();
  await context.prisma.review.deleteMany();
  await context.prisma.rating.deleteMany();
}

function ratingRequest(context: Context, user: "a" | "b", item: string, value: unknown) {
  return context.postRating(
    request(
      "/api/ratings",
      "POST",
      { musicItemId: item, value },
      user === "a" ? context.tokenA : context.tokenB,
    ),
  );
}

function reviewRequest(context: Context, user: "a" | "b", item: string, value: unknown, content: string) {
  return context.postReview(
    request(
      "/api/reviews",
      "POST",
      { musicItemId: item, content, ratingValue: value, tags: ["epic"] },
      user === "a" ? context.tokenA : context.tokenB,
    ),
  );
}

test("Rating mantiene una fila actual por usuario y elemento", async (t) => {
  const context = await setup();
  try {
    await t.test("crear y actualizar conserva el ID y no incrementa el conteo", async () => {
      await reset(context);
      const createdResponse = await ratingRequest(context, "a", ALBUM_A_ID, 2);
      assert.equal(createdResponse.status, 200);
      const created = (await createdResponse.json()).rating;

      await new Promise((resolveDelay) => setTimeout(resolveDelay, 5));
      const updatedResponse = await ratingRequest(context, "a", ALBUM_A_ID, 4.5);
      assert.equal(updatedResponse.status, 200);
      const updated = (await updatedResponse.json()).rating;

      assert.equal(updated.id, created.id);
      assert.equal(updated.value, 4.5);
      assert.ok(new Date(updated.updatedAt).getTime() > new Date(created.updatedAt).getTime());
      assert.equal(
        await context.prisma.rating.count({
          where: { userId: USER_A_ID, musicItemId: ALBUM_A_ID },
        }),
        1,
      );

      assert.equal((await ratingRequest(context, "b", ALBUM_A_ID, 3)).status, 200);
      assert.equal((await ratingRequest(context, "a", ALBUM_B_ID, 5)).status, 200);
      assert.equal(await context.prisma.rating.count(), 3);
    });

    await t.test("solicitudes concurrentes iguales y distintas terminan en una fila válida", async () => {
      await reset(context);
      const same = await Promise.all(
        Array.from({ length: 4 }, () => ratingRequest(context, "a", ALBUM_A_ID, 4)),
      );
      assert.deepEqual(same.map((response) => response.status), [200, 200, 200, 200]);
      assert.equal(await context.prisma.rating.count(), 1);
      assert.equal((await context.prisma.rating.findFirstOrThrow()).value, 4);

      await reset(context);
      const values = [1, 2.5, 5, 3.5];
      const different = await Promise.all(
        values.map((value) => ratingRequest(context, "a", ALBUM_A_ID, value)),
      );
      assert.deepEqual(different.map((response) => response.status), [200, 200, 200, 200]);
      const rows = await context.prisma.rating.findMany();
      assert.equal(rows.length, 1);
      assert.ok(values.includes(rows[0].value));
    });

    await t.test("reviews concurrentes y el flujo mixto comparten la misma invariante", async () => {
      await reset(context);
      const concurrentReviews = await Promise.all([
        reviewRequest(context, "a", ALBUM_A_ID, 2, "Concurrent review one"),
        reviewRequest(context, "a", ALBUM_A_ID, 4.5, "Concurrent review two"),
      ]);
      assert.deepEqual(concurrentReviews.map((response) => response.status), [200, 200]);
      assert.equal(await context.prisma.review.count(), 2);
      assert.equal(await context.prisma.rating.count(), 1);

      await reset(context);
      const mixed = await Promise.all([
        ratingRequest(context, "a", ALBUM_A_ID, 1.5),
        reviewRequest(context, "a", ALBUM_A_ID, 5, "Mixed concurrent review"),
      ]);
      assert.deepEqual(mixed.map((response) => response.status), [200, 200]);
      assert.equal(await context.prisma.review.count(), 1);
      const mixedRatings = await context.prisma.rating.findMany();
      assert.equal(mixedRatings.length, 1);
      assert.ok([1.5, 5].includes(mixedRatings[0].value));
    });

    await t.test("editar una review actualiza el rating y eliminarla conserva el rating actual", async () => {
      await reset(context);
      const createResponse = await reviewRequest(
        context,
        "a",
        ALBUM_A_ID,
        2.5,
        "Review to edit",
      );
      assert.equal(createResponse.status, 200);
      const reviewId = (await createResponse.json()).review.id as string;
      const ratingId = (await context.prisma.rating.findFirstOrThrow()).id;

      const patchResponse = await context.patchReview(
        request(
          `/api/reviews/${reviewId}`,
          "PATCH",
          { content: "Edited review", ratingValue: 4, tags: [] },
          context.tokenA,
        ),
        { params: { id: reviewId } },
      );
      assert.equal(patchResponse.status, 200);
      const current = await context.prisma.rating.findFirstOrThrow();
      assert.equal(current.id, ratingId);
      assert.equal(current.value, 4);
      assert.equal((await context.prisma.review.findUniqueOrThrow({ where: { id: reviewId } })).ratingValue, 4);

      const deleteResponse = await context.deleteReview(
        request(`/api/reviews/${reviewId}`, "DELETE", {}, context.tokenA),
        { params: { id: reviewId } },
      );
      assert.equal(deleteResponse.status, 200);
      assert.equal(await context.prisma.review.count(), 0);
      assert.equal(await context.prisma.rating.count(), 1);
    });

    await t.test("conteo y promedio usan una fila actual por usuario", async () => {
      await reset(context);
      assert.equal((await ratingRequest(context, "a", ALBUM_A_ID, 2)).status, 200);
      assert.equal(await context.prisma.rating.count(), 1);
      assert.equal((await ratingRequest(context, "a", ALBUM_A_ID, 4)).status, 200);
      assert.equal(await context.prisma.rating.count(), 1);
      assert.equal((await ratingRequest(context, "b", ALBUM_A_ID, 2)).status, 200);

      const aggregate = await context.prisma.rating.aggregate({
        where: { musicItemId: ALBUM_A_ID },
        _count: { id: true },
        _avg: { value: true },
      });
      assert.equal(aggregate._count.id, 2);
      assert.equal(aggregate._avg.value, 3);
    });

    await t.test("backend rechaza valores, elementos y sesiones inválidos sin escribir", async () => {
      await reset(context);
      for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
        assert.throws(() => context.parseRatingValue(value));
      }

      const invalidToken = request(
        "/api/ratings",
        "POST",
        { musicItemId: ALBUM_A_ID, value: 4 },
        "not-a-token",
      );
      const missingToken = request(
        "/api/ratings",
        "POST",
        { musicItemId: ALBUM_A_ID, value: 4 },
      );
      assert.equal((await context.postRating(invalidToken)).status, 401);
      assert.equal((await context.postRating(missingToken)).status, 401);

      for (const value of ["4", null, 0, 5.25, 6]) {
        assert.equal((await ratingRequest(context, "a", ALBUM_A_ID, value)).status, 400);
      }
      for (const rawBody of [
        `{"musicItemId":"${ALBUM_A_ID}","value":NaN}`,
        `{"musicItemId":"${ALBUM_A_ID}","value":Infinity}`,
      ]) {
        const response = await context.postRating(
          request("/api/ratings", "POST", {}, context.tokenA, rawBody),
        );
        assert.equal(response.status, 400);
      }
      assert.equal((await ratingRequest(context, "a", "missing-item", 4)).status, 404);
      assert.equal(
        (await reviewRequest(context, "a", ALBUM_A_ID, "4", "Invalid review rating")).status,
        400,
      );
      assert.equal(await context.prisma.rating.count(), 0);
      assert.equal(await context.prisma.review.count(), 0);
    });
  } finally {
    await context.prisma.$disconnect();
    context.client.close();
  }
});
