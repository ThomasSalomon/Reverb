import { DeezerAlbumSearchItem, DeezerArtistSearchItem, DeezerService } from "./deezer";
import { MusicItemWithStats, MusicService } from "./music";

export const HOME_SEARCH_LIMITS = {
  minQueryLength: 2,
  artistResults: 3,
  directAlbumResults: 6,
  featuredAlbumResults: 4,
  directCandidates: 25,
  artistAlbumCandidates: 12,
} as const;

export interface HomeSearchResponse {
  artists: DeezerArtistSearchItem[];
  directAlbums: MusicItemWithStats[];
  featuredAlbums: MusicItemWithStats[];
  partial: boolean;
}

export interface HomeSearchTiming {
  initialSearchMs: number;
  artistExpansionMs: number;
  enrichmentMs: number;
  totalMs: number;
}

export interface HomeSearchProvider {
  searchArtists(query: string, index: number, limit: number): Promise<DeezerArtistSearchItem[]>;
  searchAlbums(query: string, index: number, limit: number): Promise<DeezerAlbumSearchItem[]>;
  getArtistAlbums(artistId: string, limit: number): Promise<DeezerAlbumSearchItem[]>;
}

interface HomeSearchDependencies {
  provider: HomeSearchProvider;
  enrichAlbums: (items: DeezerAlbumSearchItem[]) => Promise<MusicItemWithStats[]>;
}

const defaultDependencies: HomeSearchDependencies = {
  provider: DeezerService,
  enrichAlbums: (items) => MusicService.blendExternalItemsForHomeSearch(items),
};

export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function getMatchTier(candidate: string, query: string): number {
  const normalizedCandidate = normalizeSearchText(candidate);
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedCandidate || !normalizedQuery) return 4;
  if (normalizedCandidate === normalizedQuery) return 0;
  if (
    normalizedCandidate.startsWith(normalizedQuery) ||
    normalizedCandidate.includes(` ${normalizedQuery}`)
  ) {
    return 1;
  }

  const queryTokens = normalizedQuery.split(" ");
  const candidateTokens = normalizedCandidate.split(" ");
  if (queryTokens.every((token) => candidateTokens.some((candidateToken) => candidateToken.includes(token)))) {
    return 2;
  }

  return 3;
}

interface RankedCandidate<T> {
  value: T;
  tier: number;
  sourceIndex: number;
}

function rankCandidates<T>(
  candidates: T[],
  query: string,
  getLabel: (candidate: T) => string,
  limit: number
): RankedCandidate<T>[] {
  return candidates
    .map((value, sourceIndex) => ({
      value,
      tier: getMatchTier(getLabel(value), query),
      sourceIndex,
    }))
    .sort((a, b) => a.tier - b.tier || a.sourceIndex - b.sourceIndex)
    .slice(0, limit);
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function composeHomeSearchResult(
  query: string,
  artists: DeezerArtistSearchItem[],
  directAlbums: DeezerAlbumSearchItem[],
  featuredAlbums: DeezerAlbumSearchItem[],
  enrichedAlbums: Map<string, MusicItemWithStats>,
  partial: boolean
): HomeSearchResponse {
  const rankedArtists = rankCandidates(
    dedupeById(artists),
    query,
    (artist) => artist.name,
    HOME_SEARCH_LIMITS.artistResults
  );
  const rankedDirectAlbums = rankCandidates(
    dedupeById(directAlbums),
    query,
    (album) => album.title,
    HOME_SEARCH_LIMITS.directAlbumResults
  );
  const directIds = new Set(rankedDirectAlbums.map(({ value }) => value.id));
  const limitedFeaturedAlbums = dedupeById(featuredAlbums).filter((album) => !directIds.has(album.id));

  return {
    artists: rankedArtists.map(({ value }) => value),
    directAlbums: rankedDirectAlbums
      .map(({ value }) => enrichedAlbums.get(value.id))
      .filter((item): item is MusicItemWithStats => Boolean(item)),
    featuredAlbums: limitedFeaturedAlbums
      .slice(0, HOME_SEARCH_LIMITS.featuredAlbumResults)
      .map((album) => enrichedAlbums.get(album.id))
      .filter((item): item is MusicItemWithStats => Boolean(item)),
    partial,
  };
}

export async function searchHomeWithTiming(
  rawQuery: string,
  dependencies: HomeSearchDependencies = defaultDependencies
): Promise<{ result: HomeSearchResponse; timing: HomeSearchTiming }> {
  const startedAt = performance.now();
  const query = rawQuery.trim();
  if (normalizeSearchText(query).length < HOME_SEARCH_LIMITS.minQueryLength) {
    throw new Error("SEARCH_QUERY_TOO_SHORT");
  }

  const initialSearchStartedAt = performance.now();
  const [artistsResult, albumsResult] = await Promise.allSettled([
    dependencies.provider.searchArtists(query, 0, HOME_SEARCH_LIMITS.directCandidates),
    dependencies.provider.searchAlbums(query, 0, HOME_SEARCH_LIMITS.directCandidates),
  ]);
  const initialSearchMs = performance.now() - initialSearchStartedAt;

  const artists = artistsResult.status === "fulfilled" ? artistsResult.value : [];
  const directAlbums = albumsResult.status === "fulfilled" ? albumsResult.value : [];
  let featuredAlbums: DeezerAlbumSearchItem[] = [];
  let partial = artistsResult.status === "rejected" || albumsResult.status === "rejected";

  const rankedArtists = rankCandidates(artists, query, (artist) => artist.name, 1)[0];
  const canExpandArtist = rankedArtists && (rankedArtists.tier === 0 || (rankedArtists.tier === 1 && normalizeSearchText(query).length >= 3));
  let artistExpansionMs = 0;

  if (canExpandArtist) {
    const artistExpansionStartedAt = performance.now();
    const featuredResult = await Promise.allSettled([
      dependencies.provider.getArtistAlbums(rankedArtists.value.id, HOME_SEARCH_LIMITS.artistAlbumCandidates),
    ]);
    artistExpansionMs = performance.now() - artistExpansionStartedAt;
    if (featuredResult[0].status === "fulfilled") {
      featuredAlbums = featuredResult[0].value;
    } else {
      partial = true;
    }
  }

  if (artistsResult.status === "rejected" && albumsResult.status === "rejected") {
    throw new Error("SEARCH_PROVIDER_UNAVAILABLE");
  }

  const allAlbums = dedupeById([...directAlbums, ...featuredAlbums]);
  const enrichmentStartedAt = performance.now();
  const enriched = await dependencies.enrichAlbums(allAlbums);
  const enrichmentMs = performance.now() - enrichmentStartedAt;
  const enrichedMap = new Map(enriched.map((item) => [item.id, item]));

  return {
    result: composeHomeSearchResult(
      query,
      artists,
      directAlbums,
      featuredAlbums,
      enrichedMap,
      partial
    ),
    timing: {
      initialSearchMs,
      artistExpansionMs,
      enrichmentMs,
      totalMs: performance.now() - startedAt,
    },
  };
}

export async function searchHome(
  rawQuery: string,
  dependencies: HomeSearchDependencies = defaultDependencies
): Promise<HomeSearchResponse> {
  const { result } = await searchHomeWithTiming(rawQuery, dependencies);
  return result;
}
