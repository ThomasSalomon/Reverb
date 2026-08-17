import assert from "node:assert/strict";
import test from "node:test";

const originalFetch = globalThis.fetch;

test.afterEach(() => { globalThis.fetch = originalFetch; });

test("music search preserves a valid empty provider response", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ data: [] }), { status: 200 });
  const { GET } = await import("../src/app/api/music/route");
  const response = await GET(new Request("http://localhost/api/music?q=without-results&limit=10"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), []);
});

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

test("music search keeps malformed provider responses distinct from an empty result", async () => {
  globalThis.fetch = async () => new Response("not-json", { status: 200 });
  const { GET } = await import("../src/app/api/music/route");
  const response = await GET(new Request("http://localhost/api/music?q=metallica&limit=10"));
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: "DEEZER_INVALID_JSON" });
});

test("artist detail accepts album entries without an embedded artist", async () => {
  const payloads = [
    { id: 1562681, name: "Ariana Grande", picture_medium: "https://images.example/artist.jpg" },
    { data: [{ id: 1, title: "Track", duration: 180, album: { id: 2, title: "Album" } }] },
    { data: [{ id: 2, title: "Album", release_date: "2024-01-01" }] },
    { data: [] },
  ];
  globalThis.fetch = async () => new Response(JSON.stringify(payloads.shift()), { status: 200 });

  const { GET } = await import("../src/app/api/artists/[id]/route");
  const response = await GET(new Request("http://localhost/api/artists/1562681"), { params: { id: "1562681" } });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.albums[0].artist, "Ariana Grande");
});
