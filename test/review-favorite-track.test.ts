import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("el editor de reseñas selecciona la canción favorita desde el tracklist del álbum", () => {
  const reviewCard = fs.readFileSync("src/components/ReviewCard/ReviewCard.tsx", "utf8");

  assert.match(reviewCard, /fetch\(`\/api\/music\/\$\{encodeURIComponent\(musicItemId\)\}`/);
  assert.match(reviewCard, /<select[\s\S]*id=\{favoriteTrackId\}/);
  assert.match(reviewCard, /t\("noFavoriteTrack"\)/);
  assert.match(reviewCard, /favoriteTrackTouched \? \{ favoriteTrack: editFavoriteTrack \} : \{\}/);
});
