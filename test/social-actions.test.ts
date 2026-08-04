import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { createClient, type Client } from "@libsql/client";
import type { PrismaClient } from "@prisma/client";

const TEST_SECRET = "social-actions-test-secret-with-enough-entropy";
const USER_A_ID = "social-user-a";
const USER_B_ID = "social-user-b";
const USER_C_ID = "social-user-c";
const REVIEW_A_ID = "social-review-a";

type Context = {
  client: Client;
  prisma: PrismaClient;
  followPost: typeof import("../src/app/api/users/[username]/follow/route").POST;
  followDelete: typeof import("../src/app/api/users/[username]/follow/route").DELETE;
  likePost: typeof import("../src/app/api/reviews/[id]/like/route").POST;
  likeDelete: typeof import("../src/app/api/reviews/[id]/like/route").DELETE;
  commentPost: typeof import("../src/app/api/reviews/[id]/comments/route").POST;
  socialService: typeof import("../src/services/social-actions").SocialActionService;
  tokenA: string;
  tokenB: string;
  tokenC: string;
};

function request(method: string, token?: string, body?: unknown): Request {
  const headers = new Headers({
    "x-user-id": USER_A_ID,
    "x-user-name": "alice",
  });
  if (token) headers.set("cookie", `token=${token}`);
  if (body !== undefined) headers.set("content-type", "application/json");
  return new Request("http://localhost/api/social", {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function setup(): Promise<Context> {
  const url = "file::memory:?cache=shared";
  process.env.JWT_SECRET = TEST_SECRET;
  process.env.DATABASE_URL = url;
  process.env.TURSO_DATABASE_URL = url;
  delete process.env.TURSO_AUTH_TOKEN;

  const client = createClient({ url });
  const migrations = resolve(import.meta.dirname, "..", "prisma", "migrations");
  for (const name of [
    "00000000000000_baseline",
    "20260802183000_unique_current_rating",
    "20260804120000_comment_idempotency",
  ]) {
    await client.executeMultiple(
      await readFile(resolve(migrations, name, "migration.sql"), "utf8"),
    );
  }
  await client.executeMultiple(`
    PRAGMA foreign_keys = ON;
    INSERT INTO "User" ("id", "username", "email", "password", "updatedAt") VALUES
      ('${USER_A_ID}', 'alice', 'alice-social@example.test', 'hash', CURRENT_TIMESTAMP),
      ('${USER_B_ID}', 'bob', 'bob-social@example.test', 'hash', CURRENT_TIMESTAMP),
      ('${USER_C_ID}', 'carol', 'carol-social@example.test', 'hash', CURRENT_TIMESTAMP);
    INSERT INTO "MusicItem" ("id", "title", "artist", "type", "coverUrl", "releaseYear")
      VALUES ('social-album', 'Social Album', 'Social Artist', 'ALBUM', 'https://example.test/social.jpg', 2026);
    INSERT INTO "Review" ("id", "content", "ratingValue", "updatedAt", "userId", "musicItemId")
      VALUES ('${REVIEW_A_ID}', 'Social review', 4, CURRENT_TIMESTAMP, '${USER_A_ID}', 'social-album');
  `);

  const auth = await import("../src/utils/auth");
  const followRoute = await import("../src/app/api/users/[username]/follow/route");
  const likeRoute = await import("../src/app/api/reviews/[id]/like/route");
  const commentsRoute = await import("../src/app/api/reviews/[id]/comments/route");
  const socialActions = await import("../src/services/social-actions");
  const { prisma } = await import("../src/services/db");

  return {
    client,
    prisma,
    followPost: followRoute.POST,
    followDelete: followRoute.DELETE,
    likePost: likeRoute.POST,
    likeDelete: likeRoute.DELETE,
    commentPost: commentsRoute.POST,
    socialService: socialActions.SocialActionService,
    tokenA: await auth.signToken({ userId: USER_A_ID, username: "alice" }),
    tokenB: await auth.signToken({ userId: USER_B_ID, username: "bob" }),
    tokenC: await auth.signToken({ userId: USER_C_ID, username: "carol" }),
  };
}

async function reset(context: Context): Promise<void> {
  for (const trigger of [
    "fail_social_follow",
    "fail_social_like",
    "fail_social_comment",
    "fail_social_notification",
  ]) {
    await context.client.execute(`DROP TRIGGER IF EXISTS "${trigger}"`);
  }
  await context.prisma.notification.deleteMany();
  await context.prisma.comment.deleteMany();
  await context.prisma.reviewLike.deleteMany();
  await context.prisma.follow.deleteMany();
}

function followPost(context: Context, username = "alice", token = context.tokenB) {
  return context.followPost(request("POST", token), { params: { username } });
}

function followDelete(context: Context, username = "alice", token = context.tokenB) {
  return context.followDelete(request("DELETE", token), { params: { username } });
}

function likePost(context: Context, reviewId = REVIEW_A_ID, token = context.tokenB) {
  return context.likePost(request("POST", token), { params: { id: reviewId } });
}

function likeDelete(context: Context, reviewId = REVIEW_A_ID, token = context.tokenB) {
  return context.likeDelete(request("DELETE", token), { params: { id: reviewId } });
}

function commentPost(
  context: Context,
  body: unknown,
  reviewId = REVIEW_A_ID,
  token = context.tokenB,
) {
  return context.commentPost(request("POST", token, body), { params: { id: reviewId } });
}

function notificationCount(context: Context, type: string) {
  return context.prisma.notification.count({ where: { type } });
}

async function withoutExpectedErrorLog(operation: () => Promise<Response>): Promise<Response> {
  const original = console.error;
  console.error = () => {};
  try {
    return await operation();
  } finally {
    console.error = original;
  }
}

test("acciones sociales son idempotentes y atomicas", async (t) => {
  const context = await setup();
  try {
    await t.test("follow crea notificacion solo en una transicion nueva", async () => {
      await reset(context);
      const created = await followPost(context);
      assert.equal(created.status, 201);
      assert.deepEqual(await created.json(), {
        message: "Ahora sigues a alice",
        following: true,
        changed: true,
        followersCount: 1,
      });

      const repeated = await followPost(context);
      assert.equal(repeated.status, 200);
      assert.equal((await repeated.json()).changed, false);
      assert.equal(await context.prisma.follow.count(), 1);
      assert.equal(await notificationCount(context, "NEW_FOLLOWER"), 1);

      const removed = await followDelete(context);
      assert.equal(removed.status, 200);
      assert.deepEqual(await removed.json(), {
        message: "Has dejado de seguir a alice",
        following: false,
        changed: true,
        followersCount: 0,
      });
      const repeatedDelete = await followDelete(context);
      assert.equal(repeatedDelete.status, 200);
      assert.equal((await repeatedDelete.json()).changed, false);

      assert.equal((await followPost(context)).status, 201);
      assert.equal(await context.prisma.follow.count(), 1);
      assert.equal(await notificationCount(context, "NEW_FOLLOWER"), 2);
      assert.equal((await followPost(context, "bob", context.tokenB)).status, 400);
      assert.equal((await followDelete(context, "bob", context.tokenB)).status, 400);
      assert.equal((await followPost(context, "missing-user")).status, 404);
    });

    await t.test("dos follows concurrentes producen una relacion y una notificacion", async () => {
      await reset(context);
      const responses = await Promise.all([followPost(context), followPost(context)]);
      assert.deepEqual(responses.map((response) => response.status).sort(), [200, 201]);
      const bodies = await Promise.all(responses.map((response) => response.json()));
      assert.ok(bodies.every((body) => body.following === true && body.followersCount === 1));
      assert.deepEqual(bodies.map((body) => body.changed).sort(), [false, true]);
      assert.equal(await context.prisma.follow.count(), 1);
      assert.equal(await notificationCount(context, "NEW_FOLLOWER"), 1);
    });

    await t.test("like y unlike exponen el estado autoritativo sin duplicar", async () => {
      await reset(context);
      const created = await likePost(context);
      assert.equal(created.status, 201);
      assert.deepEqual(await created.json(), {
        message: "Reseña gustada con éxito",
        liked: true,
        changed: true,
        likesCount: 1,
      });
      const repeated = await likePost(context);
      assert.equal(repeated.status, 200);
      assert.equal((await repeated.json()).changed, false);
      assert.equal(await context.prisma.reviewLike.count(), 1);
      assert.equal(await notificationCount(context, "NEW_LIKE"), 1);

      const removed = await likeDelete(context);
      assert.equal(removed.status, 200);
      assert.equal((await removed.json()).changed, true);
      const repeatedDelete = await likeDelete(context);
      assert.equal(repeatedDelete.status, 200);
      assert.deepEqual(await repeatedDelete.json(), {
        message: "Like removido con éxito",
        liked: false,
        changed: false,
        likesCount: 0,
      });

      assert.equal((await likePost(context)).status, 201);
      assert.equal(await notificationCount(context, "NEW_LIKE"), 2);
      assert.equal((await likePost(context, "missing-review")).status, 404);
      assert.equal((await likeDelete(context, "missing-review")).status, 404);

      await reset(context);
      assert.equal((await likePost(context, REVIEW_A_ID, context.tokenA)).status, 201);
      assert.equal(await context.prisma.reviewLike.count(), 1);
      assert.equal(await notificationCount(context, "NEW_LIKE"), 0);
    });

    await t.test("dos likes concurrentes producen una relacion y una notificacion", async () => {
      await reset(context);
      const responses = await Promise.all([likePost(context), likePost(context)]);
      assert.deepEqual(responses.map((response) => response.status).sort(), [200, 201]);
      const bodies = await Promise.all(responses.map((response) => response.json()));
      assert.ok(bodies.every((body) => body.liked === true && body.likesCount === 1));
      assert.deepEqual(bodies.map((body) => body.changed).sort(), [false, true]);
      assert.equal(await context.prisma.reviewLike.count(), 1);
      assert.equal(await notificationCount(context, "NEW_LIKE"), 1);
    });

    await t.test("operationId hace idempotente el reenvio pero no el contenido", async () => {
      await reset(context);
      const operationA = "11111111-1111-4111-8111-111111111111";
      const operationB = "22222222-2222-4222-8222-222222222222";
      const first = await commentPost(context, { content: "Comentario igual", operationId: operationA });
      assert.equal(first.status, 201);
      const firstBody = await first.json();
      assert.equal(firstBody.changed, true);
      assert.equal(firstBody.commentsCount, 1);

      const replay = await commentPost(context, { content: "Comentario igual", operationId: operationA });
      assert.equal(replay.status, 200);
      const replayBody = await replay.json();
      assert.equal(replayBody.id, firstBody.id);
      assert.equal(replayBody.changed, false);
      assert.equal(await context.prisma.comment.count(), 1);
      assert.equal(await notificationCount(context, "NEW_COMMENT"), 1);

      const sameTextNewOperation = await commentPost(context, {
        content: "Comentario igual",
        operationId: operationB,
      });
      assert.equal(sameTextNewOperation.status, 201);
      assert.equal(await context.prisma.comment.count(), 2);
      assert.equal(await notificationCount(context, "NEW_COMMENT"), 2);

      const conflictingReplay = await commentPost(context, {
        content: "Contenido distinto",
        operationId: operationA,
      });
      assert.equal(conflictingReplay.status, 409);
      assert.equal((await conflictingReplay.json()).code, "IDEMPOTENCY_CONFLICT");
      assert.equal(await context.prisma.comment.count(), 2);

      assert.equal((await commentPost(context, { content: "Cliente legado" })).status, 201);
      assert.equal((await commentPost(context, { content: "Cliente legado" })).status, 201);
      assert.equal(await context.prisma.comment.count(), 4);
    });

    await t.test("dos comentarios concurrentes con la misma operacion crean uno solo", async () => {
      await reset(context);
      const body = {
        content: "Concurrent comment",
        operationId: "33333333-3333-4333-8333-333333333333",
      };
      const responses = await Promise.all([
        commentPost(context, body),
        commentPost(context, body),
      ]);
      assert.deepEqual(responses.map((response) => response.status).sort(), [200, 201]);
      const bodies = await Promise.all(responses.map((response) => response.json()));
      assert.equal(new Set(bodies.map((item) => item.id)).size, 1);
      assert.equal(await context.prisma.comment.count(), 1);
      assert.equal(await notificationCount(context, "NEW_COMMENT"), 1);
    });

    await t.test("comentarios propios y recursos invalidos respetan el contrato", async () => {
      await reset(context);
      const own = await commentPost(
        context,
        {
          content: "Own comment",
          operationId: "44444444-4444-4444-8444-444444444444",
        },
        REVIEW_A_ID,
        context.tokenA,
      );
      assert.equal(own.status, 201);
      assert.equal(await notificationCount(context, "NEW_COMMENT"), 0);
      assert.equal(
        (await commentPost(context, { content: "Missing" }, "missing-review")).status,
        404,
      );
      assert.equal((await commentPost(context, { content: " " })).status, 400);
      assert.equal(
        (await commentPost(context, { content: "Valid", operationId: "not-a-uuid" })).status,
        400,
      );
      assert.equal(
        (await commentPost(context, { content: "Valid", userId: USER_A_ID })).status,
        400,
      );
    });

    await t.test("sesion firmada determina el actor y anonimos no escriben", async () => {
      await reset(context);
      assert.equal((await followPost(context, "alice", "")).status, 401);
      assert.equal((await likePost(context, REVIEW_A_ID, "invalid-token")).status, 401);
      assert.equal((await commentPost(context, { content: "No session" }, REVIEW_A_ID, "")).status, 401);
      assert.equal(await context.prisma.follow.count(), 0);
      assert.equal(await context.prisma.reviewLike.count(), 0);
      assert.equal(await context.prisma.comment.count(), 0);

      const forged = await commentPost(context, {
        content: "Actor from token",
        operationId: "55555555-5555-4555-8555-555555555555",
      });
      assert.equal(forged.status, 201);
      assert.equal((await context.prisma.comment.findFirstOrThrow()).userId, USER_B_ID);
    });

    await t.test("fallos de la escritura principal no dejan efectos parciales", async () => {
      const cases = [
        {
          trigger: `CREATE TRIGGER "fail_social_follow" BEFORE INSERT ON "Follow"
            BEGIN SELECT RAISE(ABORT, 'injected follow failure'); END;`,
          run: () => followPost(context),
          count: () => context.prisma.follow.count(),
        },
        {
          trigger: `CREATE TRIGGER "fail_social_like" BEFORE INSERT ON "ReviewLike"
            BEGIN SELECT RAISE(ABORT, 'injected like failure'); END;`,
          run: () => likePost(context),
          count: () => context.prisma.reviewLike.count(),
        },
        {
          trigger: `CREATE TRIGGER "fail_social_comment" BEFORE INSERT ON "Comment"
            BEGIN SELECT RAISE(ABORT, 'injected comment failure'); END;`,
          run: () => commentPost(context, {
            content: "Will fail",
            operationId: "66666666-6666-4666-8666-666666666666",
          }),
          count: () => context.prisma.comment.count(),
        },
      ];

      for (const failure of cases) {
        await reset(context);
        await context.client.executeMultiple(failure.trigger);
        assert.equal((await withoutExpectedErrorLog(failure.run)).status, 500);
        assert.equal(await failure.count(), 0);
        assert.equal(await context.prisma.notification.count(), 0);
      }
    });

    await t.test("fallo de notificacion revierte follow, like y comentario", async () => {
      const cases = [
        {
          type: "NEW_FOLLOWER",
          run: () => followPost(context),
          count: () => context.prisma.follow.count(),
        },
        {
          type: "NEW_LIKE",
          run: () => likePost(context),
          count: () => context.prisma.reviewLike.count(),
        },
        {
          type: "NEW_COMMENT",
          run: () => commentPost(context, {
            content: "Notification failure",
            operationId: "77777777-7777-4777-8777-777777777777",
          }),
          count: () => context.prisma.comment.count(),
        },
      ];

      for (const failure of cases) {
        await reset(context);
        await context.client.executeMultiple(`
          CREATE TRIGGER "fail_social_notification" BEFORE INSERT ON "Notification"
          WHEN NEW."type" = '${failure.type}'
          BEGIN SELECT RAISE(ABORT, 'injected notification failure'); END;
        `);
        assert.equal((await withoutExpectedErrorLog(failure.run)).status, 500);
        assert.equal(await failure.count(), 0);
        assert.equal(await context.prisma.notification.count(), 0);
      }
    });

    await t.test("replay tras una respuesta perdida conserva una sola transicion", async () => {
      await reset(context);
      await followPost(context);
      const followReplay = await followPost(context);
      assert.equal(followReplay.status, 200);
      assert.equal(await context.prisma.follow.count(), 1);
      assert.equal(await notificationCount(context, "NEW_FOLLOWER"), 1);

      await likePost(context);
      const likeReplay = await likePost(context);
      assert.equal(likeReplay.status, 200);
      assert.equal(await context.prisma.reviewLike.count(), 1);
      assert.equal(await notificationCount(context, "NEW_LIKE"), 1);

      const body = {
        content: "Lost response",
        operationId: "88888888-8888-4888-8888-888888888888",
      };
      await commentPost(context, body);
      const commentReplay = await commentPost(context, body);
      assert.equal(commentReplay.status, 200);
      assert.equal(await context.prisma.comment.count(), 1);
      assert.equal(await notificationCount(context, "NEW_COMMENT"), 1);
    });

    await t.test("resultado de commit incierto se reconcilia sin repetir efectos", async () => {
      await reset(context);
      let loseFirstResult = true;
      const uncertainClient = new Proxy(context.prisma, {
        get(target, property) {
          if (property === "$transaction") {
            return async (...args: unknown[]) => {
              const result = await (target.$transaction as (...values: unknown[]) => Promise<unknown>)(...args);
              if (loseFirstResult) {
                loseFirstResult = false;
                throw Object.assign(new Error("simulated unknown commit result"), { code: "P2034" });
              }
              return result;
            };
          }
          const value = Reflect.get(target, property, target);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });

      const result = await context.socialService.follow(
        { userId: USER_B_ID, username: "bob" },
        "alice",
        uncertainClient,
      );
      assert.deepEqual(result, {
        following: true,
        followersCount: 1,
        changed: false,
      });
      assert.equal(await context.prisma.follow.count(), 1);
      assert.equal(await notificationCount(context, "NEW_FOLLOWER"), 1);
    });
  } finally {
    await context.prisma.$disconnect();
    context.client.close();
  }
});
