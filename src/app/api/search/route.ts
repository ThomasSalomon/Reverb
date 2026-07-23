import { NextResponse } from "next/server";
import {
  HOME_SEARCH_LIMITS,
  HomeSearchResponse,
  HomeSearchTiming,
  normalizeSearchText,
  searchHomeWithTiming,
} from "@/services/home-search";
import { ExpiringLruCache } from "@/services/home-search-cache";

export const dynamic = "force-dynamic";

const searchCache = new ExpiringLruCache<HomeSearchResponse>(50, 30_000);

function createServerTimingHeader(timing: HomeSearchTiming): string {
  return [
    `initial;dur=${Math.round(timing.initialSearchMs)}`,
    `expansion;dur=${Math.round(timing.artistExpansionMs)}`,
    `enrichment;dur=${Math.round(timing.enrichmentMs)}`,
    `total;dur=${Math.round(timing.totalMs)}`,
  ].join(", ");
}

export async function GET(req: Request) {
  const query = new URL(req.url).searchParams.get("q")?.trim() || "";

  if (normalizeSearchText(query).length < HOME_SEARCH_LIMITS.minQueryLength) {
    return NextResponse.json({ error: "SEARCH_QUERY_TOO_SHORT" }, { status: 400 });
  }

  const cacheKey = normalizeSearchText(query);
  const cachedResult = searchCache.get(cacheKey);
  if (cachedResult) {
    return NextResponse.json(cachedResult, {
      headers: {
        "Server-Timing": 'cache;desc="hit"',
        "X-Search-Cache": "HIT",
      },
    });
  }

  try {
    const { result, timing } = await searchHomeWithTiming(query);

    if (!result.partial) {
      searchCache.set(cacheKey, result);
    }

    return NextResponse.json(result, {
      headers: {
        "Server-Timing": createServerTimingHeader(timing),
        "X-Search-Cache": "MISS",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "SEARCH_PROVIDER_UNAVAILABLE") {
      return NextResponse.json({ error: "SEARCH_UNAVAILABLE" }, { status: 502 });
    }

    console.error("Home search error:", error);
    return NextResponse.json({ error: "SEARCH_FAILED" }, { status: 500 });
  }
}
