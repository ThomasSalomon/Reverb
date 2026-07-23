import assert from "node:assert/strict";
import test from "node:test";
import { isCurrentSearchRequest } from "../src/utils/search-request";

test("only accepts the latest search response", () => {
  assert.equal(isCurrentSearchRequest(2, 2), true);
  assert.equal(isCurrentSearchRequest(1, 2), false);
});
