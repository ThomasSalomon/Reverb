import { AsyncLocalStorage } from "node:async_hooks";
import { performance } from "node:perf_hooks";
import { createBackendTestContext } from "../test/helpers/backend-test-context";

(globalThis as typeof globalThis & { AsyncLocalStorage?: typeof AsyncLocalStorage }).AsyncLocalStorage ??= AsyncLocalStorage;

type CachedEntry = { value: unknown; tags: string[] };

class LocalDataCache {
  readonly entries = new Map<string, CachedEntry>();
  readonly isOnDemandRevalidate = false;

  async fetchCacheKey(key: string): Promise<string> { return key; }
  async get(key: string): Promise<{ value: unknown; isStale: false } | null> {
    const entry = this.entries.get(key);
    return entry ? { value: entry.value, isStale: false } : null;
  }
  async set(key: string, value: unknown, context: { tags?: string[] }): Promise<void> {
    this.entries.set(key, { value, tags: context.tags ?? [] });
  }
  async revalidateTag(tag: string): Promise<void> {
    this.entries.forEach((entry, key) => {
      if (entry.tags.includes(tag)) this.entries.delete(key);
    });
  }
}

let staticGenerationAsyncStorage: any;

async function inNextCacheContext<T>(cache: LocalDataCache, action: () => Promise<T>): Promise<T> {
  const storage = staticGenerationAsyncStorage ?? await import(
    "next/dist/client/components/static-generation-async-storage.external"
  ).then((module) => module.staticGenerationAsyncStorage);
  staticGenerationAsyncStorage = storage;
  return storage.run({
    incrementalCache: cache,
    isStaticGeneration: false,
    prerenderState: null,
    urlPathname: "/api/perf-user-derived-cache",
    pagePath: "/api/perf-user-derived-cache",
    fetchCache: "auto",
  } as any, action);
}

async function timed<T>(action: () => Promise<T>): Promise<{ value: T; localMs: number }> {
  const startedAt = performance.now();
  const value = await action();
  return { value, localMs: Number((performance.now() - startedAt).toFixed(3)) };
}

async function main() {
  const context = await createBackendTestContext();
  try {
    const [statsRoute, recapRoute, reviewRoute, auth] = await Promise.all([
      import("../src/app/api/users/[username]/stats/route"),
      import("../src/app/api/users/[username]/recap/route"),
      import("../src/app/api/reviews/route"),
      import("../src/utils/auth"),
    ]);
    const year = new Date().getUTCFullYear();
    const user = await context.createUser({ username: "perf-derived-cache" });
    const item = await context.createMusicItem({ id: "perf-derived-cache-item" });
    const token = await auth.signToken({ userId: user.id, username: user.username });
    const rows = Array.from({ length: 40 }, (_, index) => ({
      userId: user.id,
      musicItemId: item.id,
      content: `Review ${index}`,
      ratingValue: (index % 10) / 2 + 0.5,
      tags: index % 2 === 0 ? "happy" : "calm",
      createdAt: new Date(Date.UTC(year, 0, index % 28 + 1)),
    }));
    await context.prisma.review.createMany({ data: rows });
    await context.prisma.rating.create({ data: { userId: user.id, musicItemId: item.id, value: 4 } });

    const cache = new LocalDataCache();
    const stats = () => inNextCacheContext(cache, () => statsRoute.GET(
      new Request(`http://localhost/api/users/${user.username}/stats`),
      { params: { username: user.username } },
    ));
    const recap = () => inNextCacheContext(cache, () => recapRoute.GET(
      new Request(`http://localhost/api/users/${user.username}/recap?year=${year}`),
      { params: { username: user.username } },
    ));
    const statsCold = await timed(stats);
    const statsWarm = await timed(stats);
    const recapCold = await timed(recap);
    const recapWarm = await timed(recap);

    await inNextCacheContext(cache, () => reviewRoute.POST(new Request("http://localhost/api/reviews", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `token=${token}` },
      body: JSON.stringify({
        musicItemId: item.id,
        content: "Review that invalidates both aggregates",
        ratingValue: 5,
        tags: ["sad"],
      }),
    })));
    const statsAfterInvalidation = await timed(stats);
    const recapAfterInvalidation = await timed(recap);

    console.log(JSON.stringify({
      dataset: { reviews: rows.length, ratings: 1 },
      stats: {
        coldMs: statsCold.localMs,
        warmMs: statsWarm.localMs,
        afterInvalidationMs: statsAfterInvalidation.localMs,
      },
      recap: {
        coldMs: recapCold.localMs,
        warmMs: recapWarm.localMs,
        afterInvalidationMs: recapAfterInvalidation.localMs,
      },
    }, null, 2));
  } finally {
    await context.close();
  }
}

void main();
