import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import type { Prisma, PrismaClient } from "@prisma/client";
import { createBackendTestContext } from "./helpers/backend-test-context";

async function routeFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return routeFiles(path);
    return entry.name === "route.ts" ? [path] : [];
  }));
  return nested.flat();
}

function putRequest(path: string, body: unknown, token?: string): Request {
  const headers = new Headers({
    "content-type": "application/json",
    "x-user-id": "forged-user",
    "x-username": "forged-user",
  });
  if (token) headers.set("cookie", `token=${token}`);
  return new Request(`http://localhost${path}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });
}

function patchRequest(path: string, body: unknown, token: string): Request {
  return new Request(`http://localhost${path}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      cookie: `token=${token}`,
    },
    body: JSON.stringify(body),
  });
}

test("API identity and use-case boundaries remain centralized", async () => {
  const files = await routeFiles(resolve("src/app/api"));
  const violations: string[] = [];
  for (const file of files) {
    const source = await readFile(file, "utf8");
    if (/\bcookies\s*\(/.test(source)) violations.push(`${file}: cookies()`);
    if (/\bverifyToken\b/.test(source)) violations.push(`${file}: verifyToken`);
    if (/x-user-(?:id|name)|x-username/i.test(source)) violations.push(`${file}: identity header`);
    if (/async function getAuthUser/.test(source)) violations.push(`${file}: local getAuthUser`);
  }
  assert.deepEqual(violations, []);

  for (const file of ["account.ts", "profile.ts", "reviews.ts"]) {
    const source = await readFile(resolve("src/services", file), "utf8");
    assert.doesNotMatch(source, /\bNextResponse\b/, `${file} must stay HTTP-independent`);
  }
});

test("extracted profile and review flows preserve authorization and persistence", async (t) => {
  const context = await createBackendTestContext();
  try {
    const [
      { PUT: updateProfileRoute },
      { GET: listReviewsRoute },
      { PATCH: updateReviewRoute },
      { PATCH: changePasswordRoute },
      auth,
      reviews,
    ] = await Promise.all([
      import("../src/app/api/users/[username]/route"),
      import("../src/app/api/reviews/route"),
      import("../src/app/api/reviews/[id]/route"),
      import("../src/app/api/users/[username]/password/route"),
      import("../src/utils/auth"),
      import("../src/services/reviews"),
    ]);

    await t.test("profile update derives the owner from the session and preserves its response", async () => {
      const owner = await context.createUser({ username: "profile-owner" });
      const attacker = await context.createUser({ username: "profile-attacker" });
      const album = await context.createMusicItem({ type: "ALBUM" });
      const ownerToken = await auth.signToken({ userId: owner.id, username: owner.username });
      const attackerToken = await auth.signToken({ userId: attacker.id, username: attacker.username });
      const path = `/api/users/${owner.username}`;

      const anonymous = await updateProfileRoute(
        putRequest(path, { bio: "anonymous write" }),
        { params: { username: owner.username } },
      );
      assert.equal(anonymous.status, 401);

      const forbidden = await updateProfileRoute(
        putRequest(path, { bio: "attacker write" }, attackerToken),
        { params: { username: owner.username } },
      );
      assert.equal(forbidden.status, 403);

      const response = await updateProfileRoute(
        putRequest(path, {
          bio: "Updated profile",
          profileColor: "violet",
          profileImage: "/avatars/default.png",
          favoriteAlbums: [{ slot: 1, musicItemId: album.id }],
        }, ownerToken),
        { params: { username: owner.username } },
      );
      assert.equal(response.status, 200);
      const payload = await response.json();
      assert.equal(payload.message, "Perfil actualizado con éxito");
      assert.equal(payload.profile.bio, "Updated profile");
      assert.equal(payload.profile.favoriteAlbums[0].musicItem.id, album.id);
      assert.equal(
        await context.prisma.favoriteAlbum.count({ where: { userId: owner.id } }),
        1,
      );

      const invalidImage = await updateProfileRoute(
        putRequest(path, { profileImage: "https://untrusted.example/avatar.png" }, ownerToken),
        { params: { username: owner.username } },
      );
      assert.equal(invalidImage.status, 400);
      const invalidImageBody = await invalidImage.json();
      assert.equal(
        invalidImageBody.error,
        "Avatar inválido. Seleccione un preset o cargue una foto.",
      );
    });

    await t.test("review enrichment keeps favorite, counts, and actor-specific likes", async () => {
      const author = await context.createUser({ username: "review-author" });
      const viewer = await context.createUser({ username: "review-viewer" });
      const item = await context.createMusicItem();
      const review = await context.createReview({
        userId: author.id,
        musicItemId: item.id,
      });
      await context.prisma.favoriteTrack.create({
        data: { userId: author.id, musicItemId: item.id, trackTitle: "Track One" },
      });
      await context.prisma.reviewLike.create({
        data: { userId: viewer.id, reviewId: review.id },
      });
      await context.prisma.comment.create({
        data: { userId: viewer.id, reviewId: review.id, content: "Great review" },
      });

      const [summary] = await reviews.enrichReviewSummaries([
        { id: review.id, userId: author.id, musicItemId: item.id },
      ], viewer.id);
      assert.deepEqual(summary, {
        id: review.id,
        userId: author.id,
        musicItemId: item.id,
        favoriteTrack: "Track One",
        likesCount: 1,
        commentsCount: 1,
        likedByUser: true,
      });

      const viewerToken = await auth.signToken({
        userId: viewer.id,
        username: viewer.username,
      });
      const response = await listReviewsRoute(new Request("http://localhost/api/reviews", {
        headers: { cookie: `token=${viewerToken}` },
      }));
      assert.equal(response.status, 200);
      const payload = await response.json() as Array<Record<string, unknown>>;
      const reviewPayload = payload.find((entry) => entry.id === review.id);
      assert.equal(reviewPayload?.favoriteTrack, "Track One");
      assert.equal(reviewPayload?.likesCount, 1);
      assert.equal(reviewPayload?.commentsCount, 1);
      assert.equal(reviewPayload?.likedByUser, true);
    });

    await t.test("review creation rolls back its rating when the review write fails", async () => {
      const author = await context.createUser({ username: "rollback-author" });
      const item = await context.createMusicItem();
      const actor = { userId: author.id };
      const failingClient = {
        review: context.prisma.review,
        $transaction(operation: (tx: Prisma.TransactionClient) => Promise<unknown>) {
          return context.prisma.$transaction((tx) => operation(new Proxy(tx, {
            get(target, property, receiver) {
              if (property === "review") {
                return {
                  create: async () => {
                    throw new Error("injected review failure");
                  },
                };
              }
              return Reflect.get(target, property, receiver);
            },
          })));
        },
      } as unknown as PrismaClient;

      await assert.rejects(reviews.createReview(actor, {
          musicItemId: item.id,
          content: "Review that must roll back",
          ratingValue: 5,
          tags: null,
        }, failingClient));

      assert.equal(
        await context.prisma.review.count({ where: { userId: author.id } }),
        0,
      );
      assert.equal(
        await context.prisma.rating.count({ where: { userId: author.id } }),
        0,
      );
    });

    await t.test("resource authorization still precedes body validation", async () => {
      const actor = await context.createUser({ username: "precedence-actor" });
      const owner = await context.createUser({ username: "precedence-owner" });
      const item = await context.createMusicItem();
      const review = await context.createReview({
        userId: owner.id,
        musicItemId: item.id,
      });
      const token = await auth.signToken({ userId: actor.id, username: actor.username });

      const missingReview = await updateReviewRoute(
        patchRequest("/api/reviews/missing-review", {}, token),
        { params: { id: "missing-review" } },
      );
      assert.equal(missingReview.status, 404);

      const forbiddenReview = await updateReviewRoute(
        patchRequest(`/api/reviews/${review.id}`, {}, token),
        { params: { id: review.id } },
      );
      assert.equal(forbiddenReview.status, 403);

      const missingAccount = await changePasswordRoute(
        patchRequest("/api/users/missing-user/password", {}, token),
        { params: { username: "missing-user" } },
      );
      assert.equal(missingAccount.status, 404);

      const forbiddenAccount = await changePasswordRoute(
        patchRequest(`/api/users/${owner.username}/password`, {}, token),
        { params: { username: owner.username } },
      );
      assert.equal(forbiddenAccount.status, 403);
    });
  } finally {
    await context.close();
  }
});

test("unexpected errors are logged internally and mapped to a safe public response", async () => {
  const { routeErrorResponse } = await import("../src/utils/http-errors");
  const originalError = console.error;
  const logged: unknown[][] = [];
  console.error = (...values: unknown[]) => logged.push(values);
  try {
    const response = routeErrorResponse(new Error("database-secret-detail"), {
      operation: "test operation",
      fallbackMessage: "Error interno seguro",
    });
    assert.equal(response.status, 500);
    const payload = await response.json();
    assert.equal(payload.error, "Error interno seguro");
    assert.doesNotMatch(JSON.stringify(payload), /database-secret-detail/);
    assert.equal(logged.length, 1);
  } finally {
    console.error = originalError;
  }
});
