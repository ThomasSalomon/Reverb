export const ARTIST_DISCOGRAPHY_PAGE_SIZE = {
  initial: 16,
  loadMore: 12,
} as const;

export interface ArtistRelease {
  id: string;
}

export function getUniqueArtistReleases<T extends ArtistRelease>(
  existingReleases: readonly T[],
  incomingReleases: readonly T[]
): T[] {
  const existingIds = new Set(existingReleases.map((release) => release.id));
  const uniqueReleases: T[] = [];

  for (const release of incomingReleases) {
    if (!existingIds.has(release.id)) {
      existingIds.add(release.id);
      uniqueReleases.push(release);
    }
  }

  return uniqueReleases;
}
