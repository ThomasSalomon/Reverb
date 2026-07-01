import { NextResponse } from "next/server";
import { MusicService } from "@/services/music";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");
    const type = searchParams.get("type") as "ALBUM" | "SONG" | null;

    if (query) {
      const results = await MusicService.searchItems(query);
      return NextResponse.json(results);
    }

    const items = await MusicService.getPopularItems();
    return NextResponse.json(items);
  } catch (error) {
    console.error("Music API fetch error:", error);
    return NextResponse.json(
      { error: "Error al obtener ítems musicales" },
      { status: 500 }
    );
  }
}
