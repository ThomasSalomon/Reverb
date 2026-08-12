import ArtistDetailClient from "./ArtistDetailClient";
import { ARTIST_DISCOGRAPHY_PAGE_SIZE } from "@/utils/artist-discography";

// Force static rendering or SSR depending on data
// Since it's dynamic based on [id], it will be SSR.
export const revalidate = 3600; // revalidate at most every hour

export default async function ArtistPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;

  // We could fetch initialData here for SSR, but we need the absolute URL for fetch in SSR,
  // or we can just import the DeezerService directly to avoid API route overhead in SSR.
  // Let's use DeezerService directly for SSR initial data.
  const { DeezerService } = await import("@/services/deezer");
  
  const decodedId = decodeURIComponent(id);
  let initialData = null;
  try {
    const artist = await DeezerService.getArtist(decodedId);
    if (artist) {
      const artistId = artist.id;
      const [topTracks, albumsPage, related] = await Promise.all([
        DeezerService.getArtistTopTracks(artistId),
        DeezerService.getArtistAlbumsPage(artistId, artist.name, 0, ARTIST_DISCOGRAPHY_PAGE_SIZE.initial),
        DeezerService.getRelatedArtists(artistId)
      ]);
      initialData = { artist, topTracks, albums: albumsPage.albums, nextAlbumOffset: albumsPage.nextIndex, related };
    }
  } catch (error) {
    console.error("Artist SSR preload failed", { code: error instanceof Error ? error.message : "UNKNOWN" });
  }

  return <ArtistDetailClient id={id} initialData={initialData} />;
}
