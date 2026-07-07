import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/services/db";
import { verifyToken } from "@/utils/auth";

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
      orderBy: {
        createdAt: "desc",
      },
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
      const reviewLikes = await prisma.reviewLike.findMany({
        where: { reviewId: { in: reviewIds } },
        select: { reviewId: true, userId: true },
      });
      const reviewComments = await prisma.comment.findMany({
        where: { reviewId: { in: reviewIds } },
        select: { reviewId: true },
      });

      // Group likes and comments
      const likesMap = new Map<string, string[]>();
      const commentsCountMap = new Map<string, number>();

      reviewLikes.forEach((l) => {
        const list = likesMap.get(l.reviewId) || [];
        list.push(l.userId);
        likesMap.set(l.reviewId, list);
      });

      reviewComments.forEach((c) => {
        const count = commentsCountMap.get(c.reviewId) || 0;
        commentsCountMap.set(c.reviewId, count + 1);
      });

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

      enrichedReviews = reviews.map((r) => {
        const key = `${r.userId}_${r.musicItemId}`;
        const likesList = likesMap.get(r.id) || [];
        return {
          ...r,
          favoriteTrack: favMap.get(key) || null,
          likesCount: likesList.length,
          commentsCount: commentsCountMap.get(r.id) || 0,
          likedByUser: currentUserId ? likesList.includes(currentUserId) : false,
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

// Create or update a review (and also upsert the corresponding rating entry)
export async function POST(req: Request) {
  try {
    const userId = req.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    const { musicItemId, content, ratingValue, tags } = await req.json();

    if (!musicItemId || !content || ratingValue === undefined) {
      return NextResponse.json(
        { error: "musicItemId, content y ratingValue son requeridos" },
        { status: 400 }
      );
    }

    // Process and validate tags
    let validTags = null;
    if (tags && Array.isArray(tags)) {
      // Limit to 5 tags, max 20 chars each to prevent abuse
      validTags = tags
        .map(t => String(t).trim().substring(0, 20))
        .filter(t => t.length > 0)
        .slice(0, 5)
        .join(",");
    }

    const numericRating = parseFloat(ratingValue);
    if (isNaN(numericRating) || numericRating < 1 || numericRating > 5 || numericRating % 0.5 !== 0) {
      return NextResponse.json(
        { error: "La calificación debe ser de 1 a 5 con incrementos de 0.5" },
        { status: 400 }
      );
    }

    // Verify item exists
    const musicItem = await prisma.musicItem.findUnique({
      where: { id: musicItemId },
    });

    if (!musicItem) {
      return NextResponse.json(
        { error: "Ítem musical no encontrado" },
        { status: 404 }
      );
    }

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

    // Since we now allow multiple reviews per album (Diary Logs), we use create instead of upsert
    const [review, rating] = await prisma.$transaction([
      prisma.review.create({
        data: {
          userId,
          musicItemId,
          content,
          ratingValue: numericRating,
          tags: validTags,
        },
      }),
      prisma.rating.create({
        data: {
          userId,
          musicItemId,
          value: numericRating,
        },
      }),
    ]);

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
    console.error("Save review error:", error);
    return NextResponse.json(
      { error: "Error al guardar la reseña" },
      { status: 500 }
    );
  }
}
