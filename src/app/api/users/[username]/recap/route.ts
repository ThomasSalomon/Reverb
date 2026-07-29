import { NextResponse } from "next/server";
import { prisma } from "@/services/db";
import { unstable_cache } from "next/cache";
import { getTopCanonicalReviewTag } from "@/utils/review-tags";

export const dynamic = "force-dynamic";

const getRecapData = async (username: string, year: number) => {
  const startDate = new Date(`${year}-01-01T00:00:00Z`);
  const endDate = new Date(`${year + 1}-01-01T00:00:00Z`);

  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true }
  });

  if (!user) {
    return { error: "Usuario no encontrado", status: 404 };
  }

  const reviews = await prisma.review.findMany({
    where: {
      userId: user.id,
      createdAt: {
        gte: startDate,
        lt: endDate
      }
    },
    select: {
      ratingValue: true,
      tags: true,
      musicItem: {
        select: {
          artist: true,
          title: true,
          coverUrl: true
        }
      }
    }
  });

  if (reviews.length === 0) {
    return { hasData: false, message: "No hay actividad para este año" };
  }

  let totalReviews = reviews.length;
  let avgRating = 0;
  const artistCounts = new Map<string, number>();

  let sumRating = 0;
  
  reviews.forEach(r => {
    sumRating += r.ratingValue;
    
    const artist = r.musicItem.artist;
    artistCounts.set(artist, (artistCounts.get(artist) || 0) + 1);

  });

  avgRating = sumRating / totalReviews;

  const topArtist = Array.from(artistCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "Desconocido";
  const topTag = getTopCanonicalReviewTag(reviews.map((review) => review.tags));
  
  const topItems = reviews
    .sort((a, b) => b.ratingValue - a.ratingValue)
    .slice(0, 3)
    .map(r => ({
      title: r.musicItem.title,
      artist: r.musicItem.artist,
      coverUrl: r.musicItem.coverUrl,
      rating: r.ratingValue
    }));

  return {
    hasData: true,
    year,
    totalReviews,
    avgRating: avgRating.toFixed(1),
    topArtist,
    topTag,
    topItems
  };
};

export async function GET(
  req: Request,
  { params }: { params: { username: string } }
) {
  try {
    const { username } = params;
    const { searchParams } = new URL(req.url);
    const yearStr = searchParams.get("year");

    if (!yearStr || !/^\d{4}$/.test(yearStr)) {
      return NextResponse.json({ error: "Año inválido" }, { status: 400 });
    }

    const year = parseInt(yearStr, 10);
    
    // Cache per user and year for 1 hour
    const getCachedRecap = unstable_cache(
      async () => getRecapData(username, year),
      ['recap', username, year.toString()],
      { revalidate: 3600, tags: ['recap'] }
    );
    
    const result = await getCachedRecap();
    
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Recap API Error:", error);
    return NextResponse.json({ error: "Error al generar recap" }, { status: 500 });
  }
}
