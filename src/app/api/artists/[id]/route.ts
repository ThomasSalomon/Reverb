import { NextResponse } from "next/server";
import { DeezerService } from "@/services/deezer";
import { ARTIST_DISCOGRAPHY_PAGE_SIZE } from "@/utils/artist-discography";
import { DeezerError, deezerHttpError } from "@/services/deezer-http";

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

    const artist = await DeezerService.getArtist(decodedId, req.signal);
    
    if (!artist) {
      return NextResponse.json({ error: "Artist not found" }, { status: 404 });
    }

    const artistId = artist.id;

    if (albumsOffset !== null) {
      const albumsPage = await DeezerService.getArtistAlbumsPage(
        artistId,
        artist.name,
        albumsOffset,
        ARTIST_DISCOGRAPHY_PAGE_SIZE.loadMore,
        req.signal,
      );

      return NextResponse.json({
        albums: albumsPage.albums,
        nextAlbumOffset: albumsPage.nextIndex,
      });
    }

    // Fetch all other data in parallel for speed
    const [topTracks, albumsPage, related] = await Promise.all([
      DeezerService.getArtistTopTracks(artistId, req.signal),
      DeezerService.getArtistAlbumsPage(artistId, artist.name, 0, ARTIST_DISCOGRAPHY_PAGE_SIZE.initial, req.signal),
      DeezerService.getRelatedArtists(artistId, req.signal)
    ]);

    return NextResponse.json({
      artist,
      topTracks,
      albums: albumsPage.albums,
      nextAlbumOffset: albumsPage.nextIndex,
      related
    });
  } catch (error) {
    if (error instanceof DeezerError) {
      const response = deezerHttpError(error);
      return NextResponse.json(response.body, { status: response.status, headers: response.headers });
    }
    console.error("Error in artist API route:", error);
    return NextResponse.json(
      { error: "Failed to load artist data" },
      { status: 500 }
    );
  }
}
