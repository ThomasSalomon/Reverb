import assert from "node:assert/strict";
import test from "node:test";
import {
  ARTIST_DISCOGRAPHY_PAGE_SIZE,
  getUniqueArtistReleases,
} from "../src/utils/artist-discography";

test("uses a bounded initial discography page and a smaller progressive batch", () => {
  assert.ok(ARTIST_DISCOGRAPHY_PAGE_SIZE.initial >= 12);
  assert.ok(ARTIST_DISCOGRAPHY_PAGE_SIZE.initial <= 20);
  assert.ok(ARTIST_DISCOGRAPHY_PAGE_SIZE.loadMore > 0);
  assert.ok(ARTIST_DISCOGRAPHY_PAGE_SIZE.loadMore <= ARTIST_DISCOGRAPHY_PAGE_SIZE.initial);
});

test("adds only releases not already visible while preserving incoming order", () => {
  const existing = [{ id: "1" }, { id: "2" }];
  const incoming = [{ id: "2" }, { id: "3" }, { id: "3" }, { id: "4" }];

  assert.deepEqual(getUniqueArtistReleases(existing, incoming), [{ id: "3" }, { id: "4" }]);
});
