import { NextResponse } from "next/server";
import { DeezerService } from "@/services/deezer";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: "Missing artist ID or name" }, { status: 400 });
    }

    // Decode URL param
    const decodedId = decodeURIComponent(id);

    const artist = await DeezerService.getArtist(decodedId);
    
    if (!artist) {
      return NextResponse.json({ error: "Artist not found" }, { status: 404 });
    }

    const artistId = artist.id;

    // Fetch all other data in parallel for speed
    const [topTracks, albums, related] = await Promise.all([
      DeezerService.getArtistTopTracks(artistId),
      DeezerService.getArtistAlbums(artistId),
      DeezerService.getRelatedArtists(artistId)
    ]);

    return NextResponse.json({
      artist,
      topTracks,
      albums,
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
