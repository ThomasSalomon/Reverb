import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/services/db";
import { RatingService } from "@/services/ratings";
import { resolveAuthUser, verifyToken } from "@/utils/auth";
import { parseCreateReviewInput, isReviewInputError } from "@/services/review-input";
import { readJsonObject } from "@/utils/request-body";

export const dynamic = "force-dynamic";

// Fetch recent reviews for activity feed (supports feed=following and username filters)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const feed = searchParams.get("feed");
    const username = searchParams.get("username");

    let whereClause = {};

    if (feed === "following") {
      const cookieStore = cookies();
      const token = cookieStore.get("token")?.value;
      if (!token) {
        return NextResponse.json({ error: "No autenticado" }, { status: 401 });
      }
      const authUser = await verifyToken(token);
      if (!authUser) {
        return NextResponse.json({ error: "Token inválido" }, { status: 401 });
      }

      const follows = await prisma.follow.findMany({
        where: { followerId: authUser.userId },
        select: { followingId: true },
      });
      const followingIds = follows.map((f) => f.followingId);

      whereClause = {
        userId: { in: followingIds },
      };
    } else if (username) {
      whereClause = {
        user: { username },
      };
    }

    const reviews = await prisma.review.findMany({
      where: whereClause,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: {
        user: {
          select: {
            id: true,
            username: true,
            profileColor: true, // We include this to display color presets in avatars
            profileImage: true,
          },
        },
        musicItem: {
          select: {
            id: true,
            title: true,
            artist: true,
            coverUrl: true,
            type: true,
          },
        },
      },
      take: 10,
    });

    // Fetch matching favorite tracks for these user/album pairs
    const userMusicPairs = reviews.map((r) => ({
      userId: r.userId,
      musicItemId: r.musicItemId,
    }));

    let enrichedReviews = reviews.map(r => ({
      ...r,
      favoriteTrack: null as string | null,
      likesCount: 0,
      commentsCount: 0,
      likedByUser: false,
    }));

    if (reviews.length > 0) {
      // 1. Fetch favorite tracks
      let favMap = new Map<string, string>();
      if (userMusicPairs.length > 0) {
        const favoriteTracks = await prisma.favoriteTrack.findMany({
          where: { OR: userMusicPairs },
          select: { userId: true, musicItemId: true, trackTitle: true },
        });
        favMap = new Map(
          favoriteTracks.map((ft) => [`${ft.userId}_${ft.musicItemId}`, ft.trackTitle])
        );
      }

      // 2. Fetch likes and comments
      const reviewIds = reviews.map((r) => r.id);
      const [reviewLikes, reviewComments] = await Promise.all([
        prisma.reviewLike.groupBy({ by: ["reviewId"], where: { reviewId: { in: reviewIds } }, _count: { _all: true } }),
        prisma.comment.groupBy({ by: ["reviewId"], where: { reviewId: { in: reviewIds } }, _count: { _all: true } }),
      ]);

      // Group likes and comments
      const likesMap = new Map<string, number>();
      const commentsCountMap = new Map<string, number>();

      reviewLikes.forEach((like) => likesMap.set(like.reviewId, like._count._all));

      reviewComments.forEach((comment) => commentsCountMap.set(comment.reviewId, comment._count._all));

      // Get auth token if available to set likedByUser
      let currentUserId: string | null = null;
      try {
        const cookieStore = cookies();
        const token = cookieStore.get("token")?.value;
        if (token) {
          const authUser = await verifyToken(token);
          if (authUser) currentUserId = authUser.userId;
        }
      } catch {}

      const currentUserLikes = currentUserId ? await prisma.reviewLike.findMany({
        where: { reviewId: { in: reviewIds }, userId: currentUserId },
        select: { reviewId: true },
      }) : [];
      const likedReviewIds = new Set(currentUserLikes.map((like) => like.reviewId));

      enrichedReviews = reviews.map((r) => {
        const key = `${r.userId}_${r.musicItemId}`;
        return {
          ...r,
          favoriteTrack: favMap.get(key) || null,
          likesCount: likesMap.get(r.id) || 0,
          commentsCount: commentsCountMap.get(r.id) || 0,
          likedByUser: currentUserId ? likedReviewIds.has(r.id) : false,
        };
      });
    }

    return NextResponse.json(enrichedReviews);
  } catch (error) {
    console.error("Fetch reviews error:", error);
    return NextResponse.json(
      { error: "Error al obtener reseñas" },
      { status: 500 }
    );
  }
}

// Create a review and atomically upsert the corresponding current rating.
export async function POST(req: Request) {
  try {
    const auth = await resolveAuthUser(req);
    if (!auth.ok) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }
    const { userId } = auth.user;

    const input = parseCreateReviewInput(await readJsonObject(req));

    // --- SECURITY 007: Rate Limiting ---
    // Limit to 20 reviews per user per day to prevent DoS via SQLite flooding
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const recentReviewsCount = await prisma.review.count({
      where: {
        userId,
        createdAt: {
          gte: yesterday,
        },
      },
    });

    if (recentReviewsCount >= 20) {
      return NextResponse.json(
        { error: "Rate limit exceeded: Has alcanzado el límite de 20 reseñas por día." },
        { status: 429 }
      );
    }

    const { review, rating } = await prisma.$transaction(async (tx) => {
      const currentRating = await RatingService.setCurrent(
        { userId, musicItemId: input.musicItemId, value: input.ratingValue },
        tx,
      );
      const createdReview = await tx.review.create({
        data: {
          userId,
          musicItemId: input.musicItemId,
          content: input.content,
          ratingValue: input.ratingValue,
          tags: input.tags,
        },
      });

      return { review: createdReview, rating: currentRating };
    });

    // Check if it's the user's first review to award "FIRST_REVIEW" badge
    const reviewsCount = await prisma.review.count({
      where: { userId }
    });

    if (reviewsCount === 1) {
      // It's their first review! Give them a badge.
      try {
        await prisma.earnedBadge.create({
          data: {
            userId,
            badgeId: "FIRST_REVIEW"
          }
        });

        const userForBadge = await prisma.user.findUnique({
          where: { id: userId },
          select: { username: true }
        });
        
        // Notify them
        await prisma.notification.create({
          data: {
            userId,
            type: "NEW_BADGE",
            message: "¡Has obtenido el logro 'Crítico en Ascenso' por tu primera reseña!",
            link: `/users/${userForBadge?.username || userId}`
          }
        });
      } catch (badgeErr) {
        // Ignore unique constraint error if they already have it (P2002)
        if ((badgeErr as any).code !== "P2002") {
          console.error("Error awarding badge:", badgeErr);
        }
      }
    }

    return NextResponse.json({
      message: "Reseña guardada con éxito",
      review,
      rating,
    });
  } catch (error) {
    if (isReviewInputError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Save review error:", error);
    return NextResponse.json(
      { error: "Error al guardar la reseña" },
      { status: 500 }
    );
  }
}
