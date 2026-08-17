import assert from "node:assert/strict";
import test from "node:test";
import { createBackendTestContext } from "./helpers/backend-test-context";

function request(token?: string): Request {
  const headers = new Headers();
  if (token) headers.set("cookie", `token=${token}`);
  return new Request("http://localhost/api/auth/me", { headers });
}

async function withoutExpectedErrorLog<T>(action: () => Promise<T>): Promise<T> {
  const original = console.error;
  console.error = () => undefined;
  try {
    return await action();
  } finally {
    console.error = original;
  }
}

test("auth/me distinguishes optional anonymity from technical failures", async () => {
  const context = await createBackendTestContext();
  const mutableEnvironment = process.env as Record<string, string | undefined>;
  const environment = {
    nodeEnv: process.env.NODE_ENV,
    jwtSecret: process.env.JWT_SECRET,
  };
  try {
    const [{ GET: me }, auth] = await Promise.all([
      import("../src/app/api/auth/me/route"),
      import("../src/utils/auth"),
    ]);
    const user = await context.createUser({ username: "auth-me-owner" });
    const token = await auth.signToken({ userId: user.id, username: user.username });

    const authenticated = await me(request(token));
    assert.equal(authenticated.status, 200);
    assert.equal((await authenticated.json()).user.id, user.id);

    const anonymous = await me(request());
    assert.equal(anonymous.status, 200);
    assert.deepEqual(await anonymous.json(), { user: null });

    const invalid = await me(request("not-a-valid-jwt"));
    assert.equal(invalid.status, 200);
    assert.deepEqual(await invalid.json(), { user: null });

    mutableEnvironment.NODE_ENV = "production";
    delete mutableEnvironment.JWT_SECRET;
    const missingSecret = await withoutExpectedErrorLog(() => me(request(token)));
    assert.equal(missingSecret.status, 500);
    assert.deepEqual(await missingSecret.json(), {
      error: "No se pudo obtener la sesión autenticada",
      code: "INTERNAL_ERROR",
    });

    if (environment.jwtSecret === undefined) delete mutableEnvironment.JWT_SECRET;
    else mutableEnvironment.JWT_SECRET = environment.jwtSecret;
    if (environment.nodeEnv === undefined) delete mutableEnvironment.NODE_ENV;
    else mutableEnvironment.NODE_ENV = environment.nodeEnv;

    const originalFindFirst = context.prisma.authSession.findFirst;
    (context.prisma.authSession as any).findFirst = async () => {
      throw new Error("injected persistence failure");
    };
    try {
      const persistenceFailure = await withoutExpectedErrorLog(() => me(request(token)));
      assert.equal(persistenceFailure.status, 500);
      assert.equal((await persistenceFailure.json()).code, "INTERNAL_ERROR");
    } finally {
      (context.prisma.authSession as any).findFirst = originalFindFirst;
    }

    const originalFindUnique = context.prisma.user.findUnique;
    (context.prisma.user as any).findUnique = async () => null;
    try {
      const inconsistentSession = await withoutExpectedErrorLog(() => me(request(token)));
      assert.equal(inconsistentSession.status, 500);
      assert.equal((await inconsistentSession.json()).code, "INTERNAL_ERROR");
    } finally {
      (context.prisma.user as any).findUnique = originalFindUnique;
    }
  } finally {
    if (environment.jwtSecret === undefined) delete mutableEnvironment.JWT_SECRET;
    else mutableEnvironment.JWT_SECRET = environment.jwtSecret;
    if (environment.nodeEnv === undefined) delete mutableEnvironment.NODE_ENV;
    else mutableEnvironment.NODE_ENV = environment.nodeEnv;
    await context.close();
  }
});
