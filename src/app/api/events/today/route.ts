import { NextResponse } from "next/server";
import { MusicEventService } from "@/services/music-event.service";
import { DeezerService } from "@/services/deezer.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const service = new MusicEventService();
    const deezerService = new DeezerService();
    const event = await service.getTodayEvent();

    if (!event) {
      return new NextResponse(null, { status: 204 }); // No content = no banner today
    }

    // Fetch artist picture to make the banner impactful
    const artist = await deezerService.getArtist(event.artistId);

    return NextResponse.json({ ...event, artistPicture: artist.picture_xl });
  } catch (error) {
    console.error("GET /api/events/today error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
