import assert from "node:assert/strict";
import test from "node:test";
import {
  COLLECTION_PAGE_DEFAULT,
  COLLECTION_PAGE_MAX,
  getPageLimit,
  pageResult,
  PaginationError,
  temporalCursor,
} from "../src/utils/cursor-pagination";

test("validates collection limits consistently", () => {
  assert.equal(getPageLimit(new URLSearchParams()), COLLECTION_PAGE_DEFAULT);
  assert.equal(getPageLimit(new URLSearchParams(`limit=${COLLECTION_PAGE_MAX}`)), COLLECTION_PAGE_MAX);
  for (const value of ["0", "-1", "1.5", "abc", String(COLLECTION_PAGE_MAX + 1), "999999999999999999999"]) {
    assert.throws(() => getPageLimit(new URLSearchParams(`limit=${value}`)), PaginationError);
  }
});

test("temporal pages use a deterministic cursor and do not repeat boundary rows", () => {
  const rows = [
    { id: "c", createdAt: new Date("2026-01-01T00:00:00.000Z") },
    { id: "b", createdAt: new Date("2026-01-01T00:00:00.000Z") },
    { id: "a", createdAt: new Date("2026-01-01T00:00:00.000Z") },
  ];
  const first = pageResult(rows, 2, "createdAt");
  assert.deepEqual(first.items.map((row) => row.id), ["c", "b"]);
  assert.equal(first.hasNextPage, true);
  const cursor = temporalCursor(new URLSearchParams(`cursor=${first.nextCursor}`));
  assert.deepEqual(cursor, { id: "b", createdAt: "2026-01-01T00:00:00.000Z" });
  assert.deepEqual(rows.filter((row) => row.id < cursor!.id).map((row) => row.id), ["a"]);
});

test("rejects malformed temporal cursors", () => {
  assert.throws(() => temporalCursor(new URLSearchParams("cursor=not-a-cursor")), PaginationError);
});
