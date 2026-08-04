import { NextResponse } from "next/server";
import { DeezerService } from "@/services/deezer";
import { DeezerError, deezerHttpError } from "@/services/deezer-http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");
    const index = Number(searchParams.get("index") ?? "0");
    const limit = Number(searchParams.get("limit") ?? "50");

    if (query) {
      const results = await DeezerService.searchArtists(query, index, limit, req.signal);
      return NextResponse.json(results);
    }

    const items = await DeezerService.getPopularArtists(req.signal);
    return NextResponse.json(items);
  } catch (error) {
    if (error instanceof DeezerError) {
      const response = deezerHttpError(error);
      return NextResponse.json(response.body, { status: response.status, headers: response.headers });
    }
    console.error("Artist API fetch error:", error);
    return NextResponse.json({ error: "ARTIST_CATALOG_FAILED" }, { status: 500 });
  }
}
