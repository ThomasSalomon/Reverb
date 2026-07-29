import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import en from "../messages/en.json";
import es from "../messages/es.json";
import pt from "../messages/pt.json";
import {
  CANONICAL_REVIEW_TAGS,
  getCanonicalReviewTag,
  getReviewTagTranslationKey,
  getTopCanonicalReviewTag,
  normalizeReviewTag,
  normalizeReviewTagsForStorage,
} from "../src/utils/review-tags";

test("normalizes every canonical mood and confirmed localized aliases", () => {
  for (const tag of CANONICAL_REVIEW_TAGS) {
    assert.equal(getCanonicalReviewTag(tag.key), tag.key);
    for (const alias of tag.aliases) assert.equal(getCanonicalReviewTag(`  ${alias.toUpperCase()}  `), tag.key);
  }

  assert.equal(getCanonicalReviewTag("Energico"), "energetic");
  assert.equal(getCanonicalReviewTag("Energético"), "energetic");
  assert.equal(getCanonicalReviewTag("Enérgico"), "energetic");
});

test("keeps free-form tags intact and does not fuzzy-match unknown values", () => {
  assert.equal(getCanonicalReviewTag("energetics"), null);
  assert.equal(normalizeReviewTag("  Mi mood personal  "), "Mi mood personal");
  assert.equal(normalizeReviewTagsForStorage(["Enérgico", "Mi mood personal", 12]), "energetic,Mi mood personal");
});

test("aggregates legacy labels under one canonical recap category and keeps the existing first-seen tie rule", () => {
  assert.equal(
    getTopCanonicalReviewTag(["Enérgico,Relaxante", "Energetic", "Energético", "mi tag libre"]),
    "energetic",
  );
  assert.equal(getTopCanonicalReviewTag(["classic", "Energetic"]), "classic");
  assert.equal(getTopCanonicalReviewTag(["mi tag libre", null]), null);
});

test("every canonical mood resolves through the three message catalogs", () => {
  for (const tag of CANONICAL_REVIEW_TAGS) {
    assert.equal(getReviewTagTranslationKey(tag.key), tag.translationKey);
    assert.ok(en.Review[tag.translationKey]);
    assert.ok(es.Review[tag.translationKey]);
    assert.ok(pt.Review[tag.translationKey]);
  }
  assert.equal(getReviewTagTranslationKey("mi tag libre"), null);
  assert.ok(en.Profile.unknownVibe);
  assert.ok(es.Profile.unknownVibe);
  assert.ok(pt.Profile.unknownVibe);
});

test("the recap endpoint returns semantic category keys and the modal does not render topTag raw", () => {
  const recapRoute = fs.readFileSync(path.join(process.cwd(), "src/app/api/users/[username]/recap/route.ts"), "utf8");
  const recapModal = fs.readFileSync(path.join(process.cwd(), "src/components/RecapModal/RecapModal.tsx"), "utf8");

  assert.match(recapRoute, /getTopCanonicalReviewTag/);
  assert.doesNotMatch(recapRoute, /const tagCounts/);
  assert.match(recapModal, /getReviewTagTranslationKey/);
  assert.doesNotMatch(recapModal, /\{data\.topTag \|\|/);
});
