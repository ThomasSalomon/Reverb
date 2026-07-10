import { NextResponse } from "next/server";
import { MusicEventService } from "@/services/music-event.service";
import { DeezerService } from "@/services/deezer.service";
import { AppError } from "@/utils/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const eventService = new MusicEventService();
    const deezerService = new DeezerService();

    // 1. Get today's event securely (No ID from client)
    const event = await eventService.getTodayEvent();
    
    if (!event) {
      return NextResponse.json(
        { error: "No event today" },
        { status: 404 }
      );
    }

    // 2. Fetch tracks for this event's artist and the artist details
    const [artist, tracks] = await Promise.all([
      deezerService.getArtist(event.artistId),
      deezerService.getTopTracks(event.artistId, 20)
    ]);

    return NextResponse.json({ artist, tracks });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    console.error("GET /api/events/today/tracks error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
