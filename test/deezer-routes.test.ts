import assert from "node:assert/strict";
import test from "node:test";

const originalFetch = globalThis.fetch;

test.afterEach(() => { globalThis.fetch = originalFetch; });

test("music search maps a Deezer rate limit to a retryable non-200 response", async () => {
  globalThis.fetch = async () => new Response("{}", { status: 429, headers: { "retry-after": "7" } });
  const { GET } = await import("../src/app/api/music/route");
  const response = await GET(new Request("http://localhost/api/music?q=metallica&limit=10"));
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("retry-after"), "7");
  assert.deepEqual(await response.json(), { error: "DEEZER_RATE_LIMITED" });
});

test("artist search rejects malformed paging before calling Deezer", async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return new Response("{}"); };
  const { GET } = await import("../src/app/api/artists/search/route");
  const response = await GET(new Request("http://localhost/api/artists/search?q=metallica&limit=1.5"));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "DEEZER_INVALID_INPUT" });
  assert.equal(calls, 0);
});
