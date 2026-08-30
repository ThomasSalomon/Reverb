import assert from "node:assert/strict";
import test from "node:test";
import {
  composeHomeSearchResult,
  HOME_SEARCH_LIMITS,
  normalizeSearchText,
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

test("groups a homonymous album with its editions and keeps the artist discography separate", () => {
  const canonicalEdition = album("album-canonical", "Metallica (Remastered 2021)");
  const deluxeEdition = album("album-deluxe", "Metallica (Remastered Deluxe Box Set)");
  const unrelatedArtistAlbum = album("album-unrelated", "Garage, Inc.");
  const artistDiscographyAlbum = album("artist-discography", "Master of Puppets (Remastered)");
  const result = composeHomeSearchResult(
    "  M\u00e9tallica  ",
    [
      { id: "artist-partial", name: "Metallica Tribute", pictureUrl: "/partial.jpg" },
      { id: "artist-exact", name: "Metallica", pictureUrl: "/exact.jpg" },
    ],
    [unrelatedArtistAlbum, deluxeEdition, canonicalEdition, album("album-partial", "Metallica Live")],
    [canonicalEdition, artistDiscographyAlbum],
    new Map([[
      "album-partial", enrichedAlbum(album("album-partial", "Metallica Live")),
    ], ["album-canonical", enrichedAlbum(canonicalEdition)], ["album-deluxe", enrichedAlbum(deluxeEdition)], ["album-unrelated", enrichedAlbum(unrelatedArtistAlbum)], ["artist-discography", enrichedAlbum(artistDiscographyAlbum)]]),
    false
  );

  assert.equal(result.artists[0].id, "artist-exact");
  assert.equal(result.titleAlbumGroups[0].primary.id, "album-deluxe");
  assert.deepEqual(result.titleAlbumGroups[0].variants.map((item) => item.id), ["album-canonical"]);
  assert.deepEqual(result.featuredAlbums.map((item) => item.id), ["artist-discography"]);
  assert.equal(result.titleAlbumGroups.some(({ primary }) => primary.id === "album-unrelated"), false);
});

test("enforces title group limits without collapsing editions from the same artist", () => {
  const directAlbums = Array.from({ length: HOME_SEARCH_LIMITS.titleMatchGroups + 2 }, (_, index) =>
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
  assert.equal(result.titleAlbumGroups.length, HOME_SEARCH_LIMITS.titleMatchGroups);
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
  assert.deepEqual(result.titleAlbumGroups.map(({ primary }) => primary.id), ["direct"]);
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
  assert.deepEqual(result.titleAlbumGroups.map(({ primary }) => primary.id), ["direct"]);
  assert.deepEqual(result.artists, []);
});

test("preserves non-Latin letters while normalizing punctuation and diacritics", async () => {
  assert.equal(normalizeSearchText("  M\u00e9tallica "), "metallica");
  assert.equal(normalizeSearchText("\u0411\u0438-2"), "\u0431\u0438 2");
  assert.equal(normalizeSearchText("\u5b87\u591a\u7530\u30d2\u30ab\u30eb"), "\u5b87\u591a\u7530\u30d2\u30ab\u30eb");

  const result = await searchHome("\u5b87\u591a\u7530\u30d2\u30ab\u30eb", {
    provider: {
      async searchArtists() { return [{ id: "utada", name: "Hikaru Utada", pictureUrl: "/artist.jpg" }]; },
      async searchAlbums() { return []; },
      async getArtistAlbums() { return []; },
    },
    async enrichAlbums() { return []; },
  });

  assert.equal(result.partial, false);
  assert.deepEqual(result.artists.map((artist) => artist.id), ["utada"]);
});
