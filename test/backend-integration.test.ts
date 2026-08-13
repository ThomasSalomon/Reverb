import assert from "node:assert/strict";
import test from "node:test";
import { createBackendTestContext } from "./helpers/backend-test-context";

function jsonRequest(
  path: string,
  body: Record<string, unknown>,
  cookie?: string,
  extraHeaders: Record<string, string> = {},
): Request {
  const headers = new Headers({ "content-type": "application/json", ...extraHeaders });
  if (cookie) headers.set("cookie", cookie);
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function cookieFrom(response: Response): string {
  const value = response.headers.get("set-cookie");
  assert.ok(value, "login must emit a session cookie");
  return value.split(";", 1)[0];
}

test("critical route handlers run against the complete migrated database", async (t) => {
  const context = await createBackendTestContext();
  try {
    const [{ POST: login }, { GET: me }, { POST: saveRating }, { POST: createDiary }, auth] =
      await Promise.all([
        import("../src/app/api/auth/login/route"),
        import("../src/app/api/auth/me/route"),
        import("../src/app/api/ratings/route"),
        import("../src/app/api/diary/route"),
        import("../src/utils/auth"),
      ]);

    await t.test("login creates a persisted HttpOnly session that the auth contract resolves", async () => {
      const user = await context.createUser({ username: "login-owner", password: "correct-password" });
      const response = await login(
        jsonRequest("/api/auth/login", {
          usernameOrEmail: user.username,
          password: user.password,
        }),
      );

      assert.equal(response.status, 200);
      assert.match(response.headers.get("set-cookie") ?? "", /HttpOnly/i);
      assert.match(response.headers.get("set-cookie") ?? "", /SameSite=Strict/i);
      const sessionCookie = cookieFrom(response);
      assert.equal(await context.prisma.authSession.count({ where: { userId: user.id } }), 1);

      const meResponse = await me(new Request("http://localhost/api/auth/me", {
        headers: { cookie: sessionCookie },
      }));
      assert.equal(meResponse.status, 200);
      assert.equal((await meResponse.json()).user.id, user.id);
    });

    await t.test("ratings ignore forged identity headers and preserve the unique current row under concurrency", async () => {
      const owner = await context.createUser({ username: "rating-owner" });
      const forged = await context.createUser({ username: "forged-header-user" });
      const item = await context.createMusicItem();
      const token = await auth.signToken({ userId: owner.id, username: owner.username });
      const cookie = `token=${token}`;

      const responses = await Promise.all(
        [1, 2.5, 4, 5].map((value) => saveRating(jsonRequest(
          "/api/ratings",
          { musicItemId: item.id, value },
          cookie,
          { "x-user-id": forged.id, "x-user-name": forged.username },
        ))),
      );
      assert.deepEqual(responses.map((response) => response.status), [200, 200, 200, 200]);

      const ratings = await context.prisma.rating.findMany({ where: { musicItemId: item.id } });
      assert.equal(ratings.length, 1);
      assert.equal(ratings[0]?.userId, owner.id);
      assert.ok([1, 2.5, 4, 5].includes(ratings[0]?.value ?? Number.NaN));

      const invalid = await saveRating(jsonRequest(
        "/api/ratings",
        { musicItemId: item.id, value: 5.25 },
        cookie,
      ));
      assert.equal(invalid.status, 400);
      assert.equal(await context.prisma.rating.count({ where: { musicItemId: item.id } }), 1);
    });

    await t.test("diary writes independent events and reports validation errors without partial rows", async () => {
      const user = await context.createUser({ username: "diary-owner" });
      const item = await context.createMusicItem({ type: "ALBUM" });
      const cookie = `token=${await auth.signToken({ userId: user.id, username: user.username })}`;

      const first = await createDiary(jsonRequest(
        "/api/diary",
        { musicItemId: item.id, listenedAt: "2026-08-01", notes: "First listen" },
        cookie,
      ));
      const second = await createDiary(jsonRequest(
        "/api/diary",
        { musicItemId: item.id, listenedAt: "2026-08-02", notes: "Second listen" },
        cookie,
      ));
      assert.deepEqual([first.status, second.status], [201, 201]);
      assert.equal(await context.prisma.diaryLog.count({ where: { userId: user.id, musicItemId: item.id } }), 2);

      const invalid = await createDiary(jsonRequest(
        "/api/diary",
        { musicItemId: item.id, listenedAt: "not-a-date" },
        cookie,
      ));
      assert.equal(invalid.status, 400);
      assert.equal(await context.prisma.diaryLog.count({ where: { userId: user.id, musicItemId: item.id } }), 2);
    });
  } finally {
    await context.close();
  }
});
