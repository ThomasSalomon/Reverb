import assert from "node:assert/strict";
import test from "node:test";
import { ExpiringLruCache } from "../src/services/home-search-cache";

test("expires entries after the configured TTL", () => {
  const cache = new ExpiringLruCache<string>(2, 30_000);
  cache.set("metallica", "result", 1_000);

  assert.equal(cache.get("metallica", 30_999), "result");
  assert.equal(cache.get("metallica", 31_000), undefined);
});

test("evicts the least recently used entry when capacity is reached", () => {
  const cache = new ExpiringLruCache<string>(2, 30_000);
  cache.set("metallica", "a", 0);
  cache.set("black-album", "b", 0);
  assert.equal(cache.get("metallica", 1), "a");
  cache.set("ride-the-lightning", "c", 2);

  assert.equal(cache.get("black-album", 2), undefined);
  assert.equal(cache.get("metallica", 2), "a");
  assert.equal(cache.get("ride-the-lightning", 2), "c");
});
