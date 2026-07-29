import assert from "node:assert/strict";
import test from "node:test";
import { getCoverTilt } from "../src/utils/cover-tilt";

test("cover tilt keeps its interactive transform when motion is allowed", () => {
  const tilt = getCoverTilt(false, { x: 100, y: 0, width: 200, height: 200 });

  assert.equal(tilt.transform, "rotateX(10deg) rotateY(0deg) scale(1.03)");
  assert.match(tilt.glow, /radial-gradient/);
});

test("cover tilt is completely stable when reduced motion is requested", () => {
  const tilt = getCoverTilt(true, { x: 100, y: 0, width: 200, height: 200 });

  assert.equal(tilt.transform, "rotateX(0deg) rotateY(0deg) scale(1)");
  assert.equal(tilt.glow, "transparent");
});
