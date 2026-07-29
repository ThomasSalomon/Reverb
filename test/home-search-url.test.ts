import assert from "node:assert/strict";
import test from "node:test";
import {
  getHomeSearchHref,
  getSearchQuery,
  isHomeSearchMode,
} from "../src/utils/home-search-url";

test("reads the normalized home search query and respects the existing minimum", () => {
  assert.equal(getSearchQuery(new URLSearchParams("q=%20Radiohead%20")), "Radiohead");
  assert.equal(isHomeSearchMode("r"), false);
  assert.equal(isHomeSearchMode("ra"), true);
});

test("updates only q while preserving unrelated query parameters", () => {
  const current = new URLSearchParams("tab=following&source=navbar&q=old");

  assert.equal(
    getHomeSearchHref("/", current, "  Radiohead  "),
    "/?tab=following&source=navbar&q=Radiohead"
  );
  assert.equal(getHomeSearchHref("/", current, ""), "/?tab=following&source=navbar");
});
