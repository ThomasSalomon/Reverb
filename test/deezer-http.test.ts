import assert from "node:assert/strict";
import test from "node:test";
import {
  DEEZER_SEARCH_LIMIT_MAX,
  DeezerError,
  getDeezerJson,
  requireDeezerPage,
} from "../src/services/deezer-http";
import { DeezerService } from "../src/services/deezer";

const originalFetch = globalThis.fetch;

test.afterEach(() => { globalThis.fetch = originalFetch; });

test("normalizes a valid empty Deezer collection without treating it as an error", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ data: [] }), { status: 200 });
  assert.deepEqual(await DeezerService.searchAlbums("empty", 0, 1), []);
});

test("rejects out-of-range page inputs before starting a request", () => {
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return new Response("{}"); };
  assert.throws(() => requireDeezerPage(-1, 1, "test"), (error: unknown) => error instanceof DeezerError && error.code === "DEEZER_INVALID_INPUT");
  assert.throws(() => requireDeezerPage(0, DEEZER_SEARCH_LIMIT_MAX + 1, "test"), DeezerError);
  assert.equal(calls, 0);
});

test("classifies provider statuses and preserves retry-after", async () => {
  globalThis.fetch = async () => new Response("{}", { status: 429, headers: { "retry-after": "12" } });
  await assert.rejects(
    getDeezerJson("/chart/0/albums", { operation: "test" }),
    (error: unknown) => error instanceof DeezerError && error.code === "DEEZER_RATE_LIMITED" && error.status === 503 && error.retryAfter === "12",
  );
});

test("classifies provider 4xx, not-found and 5xx without collapsing them into an empty collection", async () => {
  const cases: Array<[number, "DEEZER_CLIENT_ERROR" | "DEEZER_NOT_FOUND" | "DEEZER_SERVER_ERROR"]> = [
    [400, "DEEZER_CLIENT_ERROR"], [404, "DEEZER_NOT_FOUND"], [500, "DEEZER_SERVER_ERROR"], [503, "DEEZER_SERVER_ERROR"],
  ];
  for (const [status, code] of cases) {
    globalThis.fetch = async () => new Response("{}", { status });
    await assert.rejects(getDeezerJson("/chart/0/albums", { operation: "test" }), (error: unknown) => error instanceof DeezerError && error.code === code);
  }
});

test("classifies invalid JSON and malformed payloads instead of returning an empty result", async () => {
  globalThis.fetch = async () => new Response("not-json", { status: 200 });
  await assert.rejects(getDeezerJson("/chart/0/albums", { operation: "test" }), (error: unknown) => error instanceof DeezerError && error.code === "DEEZER_INVALID_JSON");
  globalThis.fetch = async () => new Response(JSON.stringify({ data: [{ id: "wrong" }] }), { status: 200 });
  await assert.rejects(DeezerService.searchAlbums("bad", 0, 1), (error: unknown) => error instanceof DeezerError && error.code === "DEEZER_INVALID_PAYLOAD");
});

test("aborts a slow request as a timeout and distinguishes an external cancellation", async () => {
  globalThis.fetch = (_input, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
  });
  await assert.rejects(getDeezerJson("/chart/0/albums", { operation: "test", timeoutMs: 5 }), (error: unknown) => error instanceof DeezerError && error.code === "DEEZER_TIMEOUT");
  const controller = new AbortController();
  const cancelled = getDeezerJson("/chart/0/albums", { operation: "test", signal: controller.signal, timeoutMs: 50 });
  controller.abort();
  await assert.rejects(cancelled, (error: unknown) => error instanceof DeezerError && error.code === "DEEZER_CANCELLED");
});
