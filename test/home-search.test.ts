import assert from "node:assert/strict";
import test from "node:test";
import {
  composeHomeSearchResult,
  HOME_SEARCH_LIMITS,
  searchHome,
} from "../src/services/home-search";

const album = (id: string, title: string, artist = "Metallica") => ({
  id,
  title,
  artist,
  coverUrl: "/cover.jpg",
  releaseYear: 1991,
});

const enrichedAlbum = (item: ReturnType<typeof album>) => ({
  ...item,
  type: "ALBUM",
  tracks: null,
  createdAt: new Date("2020-01-01"),
  reviews: [],
  stats: {
    averageRating: 0,
    totalRatings: 0,
    totalReviews: 0,
  },
});

test("prioritizes exact normalized matches and returns homonymous artist and album", () => {
  const exactAlbum = album("album-exact", "Metallica");
  const featuredEdition = album("album-edition", "Metallica");
  const result = composeHomeSearchResult(
    "  M\u00e9tallica  ",
    [
      { id: "artist-partial", name: "Metallica Tribute", pictureUrl: "/partial.jpg" },
      { id: "artist-exact", name: "Metallica", pictureUrl: "/exact.jpg" },
    ],
    [album("album-partial", "Metallica Live"), exactAlbum],
    [exactAlbum, featuredEdition],
    new Map([[
      "album-partial",
      enrichedAlbum(album("album-partial", "Metallica Live")),
    ], ["album-exact", enrichedAlbum(exactAlbum)], ["album-edition", enrichedAlbum(featuredEdition)]]),
    false
  );

  assert.equal(result.artists[0].id, "artist-exact");
  assert.equal(result.directAlbums[0].id, "album-exact");
  assert.deepEqual(result.featuredAlbums.map((item) => item.id), ["album-edition"]);
});

test("enforces per-group limits without collapsing distinct editions", () => {
  const directAlbums = Array.from({ length: HOME_SEARCH_LIMITS.directAlbumResults + 2 }, (_, index) =>
    album(`direct-${index}`, `Metallica ${index}`)
  );
  const featuredAlbums = Array.from({ length: HOME_SEARCH_LIMITS.featuredAlbumResults + 2 }, (_, index) =>
    album(`featured-${index}`, "Metallica")
  );
  const allAlbums = [...directAlbums, ...featuredAlbums];
  const result = composeHomeSearchResult(
    "metallica",
    Array.from({ length: HOME_SEARCH_LIMITS.artistResults + 2 }, (_, index) => ({
      id: `artist-${index}`,
      name: `Metallica ${index}`,
      pictureUrl: "/artist.jpg",
    })),
    directAlbums,
    featuredAlbums,
    new Map(allAlbums.map((item) => [item.id, enrichedAlbum(item)])),
    false
  );

  assert.equal(result.artists.length, HOME_SEARCH_LIMITS.artistResults);
  assert.equal(result.directAlbums.length, HOME_SEARCH_LIMITS.directAlbumResults);
  assert.equal(result.featuredAlbums.length, HOME_SEARCH_LIMITS.featuredAlbumResults);
  assert.equal(new Set(result.featuredAlbums.map((item) => item.id)).size, result.featuredAlbums.length);
});

test("expands only one confident artist and performs one album enrichment", async () => {
  const calls = { artists: 0, albums: 0, featured: 0, enrich: 0 };
  const directAlbum = album("direct", "Metallica");
  const featuredAlbum = album("featured", "Ride the Lightning");
  const result = await searchHome("metallica", {
    provider: {
      async searchArtists() {
        calls.artists += 1;
        return [{ id: "artist", name: "Metallica", pictureUrl: "/artist.jpg" }];
      },
      async searchAlbums() {
        calls.albums += 1;
        return [directAlbum];
      },
      async getArtistAlbums() {
        calls.featured += 1;
        return [featuredAlbum];
      },
    },
    async enrichAlbums(items) {
      calls.enrich += 1;
      return items.map(enrichedAlbum);
    },
  });

  assert.deepEqual(calls, { artists: 1, albums: 1, featured: 1, enrich: 1 });
  assert.deepEqual(result.directAlbums.map((item) => item.id), ["direct"]);
  assert.deepEqual(result.featuredAlbums.map((item) => item.id), ["featured"]);
});

test("preserves album results when the artist query fails", async () => {
  const directAlbum = album("direct", "Metallica");
  const result = await searchHome("metallica", {
    provider: {
      async searchArtists() {
        throw new Error("Deezer artist search unavailable");
      },
      async searchAlbums() {
        return [directAlbum];
      },
      async getArtistAlbums() {
        throw new Error("should not expand without an artist");
      },
    },
    async enrichAlbums(items) {
      return items.map(enrichedAlbum);
    },
  });

  assert.equal(result.partial, true);
  assert.deepEqual(result.directAlbums.map((item) => item.id), ["direct"]);
  assert.deepEqual(result.artists, []);
});
