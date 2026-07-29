import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

test("global text and motion tokens protect readable metadata and reduced motion", () => {
  const css = read("src/app/globals.css");

  assert.match(css, /--text-muted:\s*#7b7b91/);
  assert.doesNotMatch(css, /--text-muted:\s*#62627a/);
  assert.match(css, /--text-disabled:/);
  assert.match(css, /--color-success:/);
  assert.match(css, /--color-warning:/);
  assert.match(css, /--color-error:/);
  assert.match(css, /--color-info:/);
  assert.match(css, /animation-delay:\s*0\.01ms !important/);
  assert.match(css, /input::placeholder/);
});

test("motion-heavy surfaces provide a stable reduced-motion mode", () => {
  const cover = read("src/components/Cover3D/Cover3D.tsx");
  const recap = read("src/components/RecapModal/RecapModal.module.css");
  const artist = read("src/app/[locale]/artists/[id]/ArtistDetailClient.tsx");
  const banner = read("src/components/SpecialDayBanner/SpecialDayBanner.tsx");

  assert.match(cover, /usePrefersReducedMotion/);
  assert.match(cover, /onMouseMove=\{prefersReducedMotion \? undefined/);
  assert.match(recap, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(recap, /\.vinylDisc,/);
  assert.match(artist, /useReducedMotion/);
  assert.match(banner, /initial=\{prefersReducedMotion \? false/);
});
