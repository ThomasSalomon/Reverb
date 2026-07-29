import { NextResponse } from "next/server";
import { DeezerService } from "@/services/deezer";
import { ARTIST_DISCOGRAPHY_PAGE_SIZE } from "@/utils/artist-discography";

function getAlbumsOffset(request: Request): number | null | "invalid" {
  const value = new URL(request.url).searchParams.get("albumsOffset");
  if (value === null) return null;

  const offset = Number(value);
  return Number.isSafeInteger(offset) && offset > 0 ? offset : "invalid";
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: "Missing artist ID or name" }, { status: 400 });
    }

    const albumsOffset = getAlbumsOffset(req);
    if (albumsOffset === "invalid") {
      return NextResponse.json({ error: "Invalid albums offset" }, { status: 400 });
    }

    // Decode URL param
    const decodedId = decodeURIComponent(id);

    if (albumsOffset !== null && /^\d+$/.test(decodedId)) {
      const albumsPage = await DeezerService.getArtistAlbumsPage(
        decodedId,
        albumsOffset,
        ARTIST_DISCOGRAPHY_PAGE_SIZE.loadMore
      );

      return NextResponse.json({
        albums: albumsPage.albums,
        nextAlbumOffset: albumsPage.nextIndex,
      });
    }

    const artist = await DeezerService.getArtist(decodedId);
    
    if (!artist) {
      return NextResponse.json({ error: "Artist not found" }, { status: 404 });
    }

    const artistId = artist.id;

    if (albumsOffset !== null) {
      const albumsPage = await DeezerService.getArtistAlbumsPage(
        artistId,
        albumsOffset,
        ARTIST_DISCOGRAPHY_PAGE_SIZE.loadMore
      );

      return NextResponse.json({
        albums: albumsPage.albums,
        nextAlbumOffset: albumsPage.nextIndex,
      });
    }

    // Fetch all other data in parallel for speed
    const [topTracks, albumsPage, related] = await Promise.all([
      DeezerService.getArtistTopTracks(artistId),
      DeezerService.getArtistAlbumsPage(artistId, 0, ARTIST_DISCOGRAPHY_PAGE_SIZE.initial),
      DeezerService.getRelatedArtists(artistId)
    ]);

    return NextResponse.json({
      artist,
      topTracks,
      albums: albumsPage.albums,
      nextAlbumOffset: albumsPage.nextIndex,
      related
    });
  } catch (error) {
    console.error("Error in artist API route:", error);
    return NextResponse.json(
      { error: "Failed to load artist data" },
      { status: 500 }
    );
  }
}
