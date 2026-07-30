import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

test("album detail keeps decorative motion separate from rating and favorite requests", () => {
  const album = read("src/app/[locale]/albums/[id]/AlbumDetailClient.tsx");
  const styles = read("src/app/[locale]/albums/[id]/page.module.css");

  assert.match(album, /className=\{styles\.coverAura\} aria-hidden="true"/);
  assert.match(album, /className=\{styles\.coverAuraAccent\} aria-hidden="true"/);
  assert.match(album, /\{album\.coverUrl && \(/);
  assert.match(album, /feedbackValue=\{ratingFeedbackValue\}/);
  assert.match(album, /setRatingFeedbackId\(\(current\) => current \+ 1\)/);
  assert.match(album, /setFavoriteTrackFeedback\(\{ trackTitle, added: !isCurrentFav \}\)/);
  assert.match(styles, /pointer-events:\s*none/);
  assert.match(styles, /\.coverAuraAccent/);
  assert.match(styles, /blur\(38px\)/);
  assert.match(styles, /transparent 96%/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /\.favTrackAdded \.heartIconActive/);
});

test("profile and explore tabs retain tab semantics while sharing a uniquely scoped motion indicator", () => {
  const profile = read("src/app/[locale]/users/[username]/ProfileTabNavigation.tsx");
  const explore = read("src/app/[locale]/explore/ExploreTabs.tsx");

  assert.match(profile, /role="tablist"/);
  assert.match(profile, /layoutId=\{`profile-tab-indicator-\$\{motionId\}`\}/);
  assert.match(profile, /reducedMotionDuration\(prefersReducedMotion, MOTION_DURATION\.fast\)/);
  assert.match(explore, /role="tablist"/);
  assert.match(explore, /aria-selected=\{isActive\}/);
  assert.match(explore, /handleTabKeyDown/);
  assert.match(explore, /layoutId=\{`explore-tab-indicator-\$\{motionId\}`\}/);
});

test("discography cards use one viewport observer and skip entrance movement when reduced motion is requested", () => {
  const artist = read("src/app/[locale]/artists/[id]/ArtistDetailClient.tsx");
  const styles = read("src/app/[locale]/artists/[id]/page.module.css");

  assert.match(artist, /const discographyRef = useRef<HTMLDivElement>\(null\)/);
  assert.match(artist, /new IntersectionObserver/);
  assert.match(artist, /observer\.disconnect\(\)/);
  assert.match(artist, /if \(prefersReducedMotion\) \{/);
  assert.match(styles, /\.albumsGridEntered \.albumCard:nth-child\(-n \+ 6\)/);
  assert.match(styles, /translateY\(12px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});
