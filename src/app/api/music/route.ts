import { NextResponse } from "next/server";
import { MusicService } from "@/services/music";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");
    const index = parseInt(searchParams.get("index") || "0", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    if (query) {
      const results = await MusicService.searchItems(query, index, limit).catch((err) => {
        console.error("searchItems failed:", err);
        return [];
      });
      return NextResponse.json(results);
    }

    const items = await MusicService.getPopularItems().catch((err) => {
      console.error("getPopularItems failed:", err);
      return [];
    });
    return NextResponse.json(items);
  } catch (error) {
    console.error("Music API fetch error:", error);
    // Return empty array instead of 500 so the UI doesn't crash
    return NextResponse.json([]);
  }
}
