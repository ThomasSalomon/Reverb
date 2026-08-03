import { NextResponse } from "next/server";
import { prisma } from "@/services/db";
import { DiaryService } from "@/services/diary";
import { unstable_cache } from "next/cache";

// Cache stats for 1 hour to prevent DoS from heavy aggregation queries
export const revalidate = 3600;

const getStatsData = async (username: string) => {
  // 1. Fetch user to verify existence
  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });

  if (!user) {
    return { error: "Usuario no encontrado", status: 404 };
  }

  const userId = user.id;

  // 2. Fetch rating distribution (Prisma groupBy for DB-level optimization)
  const rawDistribution = await prisma.review.groupBy({
    by: ["ratingValue"],
    where: { userId },
    _count: {
      id: true,
    },
  });

  // Format distribution into a map of rating values
  const ratingDistribution: Record<number, number> = {};
  for (let r = 0.5; r <= 5.0; r += 0.5) {
    ratingDistribution[r] = 0;
  }
  rawDistribution.forEach((dist) => {
    ratingDistribution[dist.ratingValue] = dist._count.id;
  });

  // 3. Fetch reviews with musicItem details for artist and type aggregates
  const userReviews = await prisma.review.findMany({
    where: { userId },
    select: {
      musicItem: {
        select: {
          artist: true,
          tracks: true,
        },
      },
    },
  });

  // Aggregate top artists
  const artistCounts: Record<string, number> = {};
  userReviews.forEach((rev) => {
    const artist = rev.musicItem?.artist;
    if (artist) {
      artistCounts[artist] = (artistCounts[artist] || 0) + 1;
    }
  });

  const topArtists = Object.entries(artistCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Calculate total ratings and average
  const ratings = await prisma.rating.findMany({
    where: { userId },
    select: { value: true },
  });

  const totalRatings = ratings.length;
  const averageRating =
    totalRatings > 0
      ? ratings.reduce((acc, curr) => acc + curr.value, 0) / totalRatings
      : 0;

  return {
    userId,
    ratingDistribution,
    topArtists,
    totalRatings,
    averageRating,
  };
};

export async function GET(
  req: Request,
  { params }: { params: { username: string } }
) {
  try {
    const { username } = params;

    const getCachedStats = unstable_cache(
      async () => getStatsData(username),
      ['stats', username],
      { revalidate: 3600, tags: ['stats'] }
    );

    const result = await getCachedStats();

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    const { userId, ...reviewAndRatingStats } = result;
    const diaryStats = await DiaryService.getStats(userId);

    return NextResponse.json({
      ...reviewAndRatingStats,
      ...diaryStats,
    });
  } catch (error) {
    console.error("GET user stats error:", error);
    return NextResponse.json(
      { error: "Error al obtener estadísticas del usuario" },
      { status: 500 }
    );
  }
}
