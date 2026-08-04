import { NextResponse } from "next/server";
import { MusicService } from "@/services/music";
import { DeezerError, deezerHttpError } from "@/services/deezer-http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");
    const index = Number(searchParams.get("index") ?? "0");
    const limit = Number(searchParams.get("limit") ?? "50");

    if (query) {
      const results = await MusicService.searchItems(query, index, limit, req.signal);
      return NextResponse.json(results);
    }

    const items = await MusicService.getPopularItems(req.signal);
    return NextResponse.json(items);
  } catch (error) {
    if (error instanceof DeezerError) {
      const response = deezerHttpError(error);
      return NextResponse.json(response.body, { status: response.status, headers: response.headers });
    }
    console.error("Music API fetch error:", error);
    return NextResponse.json({ error: "MUSIC_CATALOG_FAILED" }, { status: 500 });
  }
}
