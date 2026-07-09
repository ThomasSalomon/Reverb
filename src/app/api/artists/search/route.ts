import { NextResponse } from "next/server";
import { DeezerService } from "@/services/deezer";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");
    const index = parseInt(searchParams.get("index") || "0", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    if (query) {
      const results = await DeezerService.searchArtists(query, index, limit).catch((err) => {
        console.error("searchArtists failed:", err);
        return [];
      });
      return NextResponse.json(results);
    }

    const items = await DeezerService.getPopularArtists().catch((err) => {
      console.error("getPopularArtists failed:", err);
      return [];
    });
    return NextResponse.json(items);
  } catch (error) {
    console.error("Artist API fetch error:", error);
    return NextResponse.json([]);
  }
}
