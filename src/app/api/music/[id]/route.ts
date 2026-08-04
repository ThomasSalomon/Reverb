import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { MusicService } from "@/services/music";
import { verifyToken } from "@/utils/auth";
import { prisma } from "@/services/db";
import { descendingTemporalWhere, getPageLimit, pageResult, PaginationError, temporalCursor } from "@/utils/cursor-pagination";
import { DeezerError, deezerHttpError } from "@/services/deezer-http";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const searchParams = new URL(req.url).searchParams;
    const limit = getPageLimit(searchParams);
    const cursor = temporalCursor(searchParams);

    let currentUserId: string | null = null;
    try {
      const cookieStore = cookies();
      const token = cookieStore.get("token")?.value;
      if (token) {
        const authUser = await verifyToken(token);
        if (authUser) {
          currentUserId = authUser.userId;
        }
      }
    } catch (e) {
      console.error("Failed to verify token:", e);
    }

    const item = await MusicService.getItemById(id, req.signal);

    if (!item) {
      return NextResponse.json(
        { error: "Ítem musical no encontrado" },
        { status: 404 }
      );
    }

    const reviews = await prisma.review.findMany({
      where: { musicItemId: id, ...(cursor ? { OR: descendingTemporalWhere(cursor) } : {}) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      include: { user: { select: { id: true, username: true, profileColor: true, profileImage: true } } },
    });
    const reviewPage = pageResult(reviews, limit, "createdAt");

    // Check if current user has marked a favorite track on this album
    let favoriteTrack: string | null = null;
    let isListenLater = false;
    let currentUserRating: number | null = null;
    let enrichedReviews = reviewPage.items;
    try {
      if (currentUserId) {
        const record = await prisma.favoriteTrack.findFirst({
          where: {
            userId: currentUserId,
            musicItemId: id,
          },
          select: { trackTitle: true },
        });
        favoriteTrack = record?.trackTitle || null;

        const listenLaterRecord = await prisma.listenLater.findFirst({
          where: {
            userId: currentUserId,
            musicItemId: id,
          },
          select: { userId: true },
        });
        isListenLater = !!listenLaterRecord;

        const ratingRecord = await prisma.rating.findUnique({
          where: {
            userId_musicItemId: {
              userId: currentUserId,
              musicItemId: id,
            },
          },
          select: { value: true },
        });
        currentUserRating = ratingRecord?.value || null;
      }

      // Fetch favorite tracks for all authors of the reviews on this album
      const reviewUserIds = reviewPage.items.map((review) => review.userId);
      if (reviewUserIds.length > 0) {
        const favTracks = await prisma.favoriteTrack.findMany({
          where: {
            musicItemId: id,
            userId: { in: reviewUserIds },
          },
          select: {
            userId: true,
            trackTitle: true,
          },
        });
        const favMap = new Map(favTracks.map((ft: any) => [ft.userId, ft.trackTitle]));
        
        // Fetch likes and comments count
        const reviewIds = reviewPage.items.map((review) => review.id);
        const [reviewLikes, reviewComments, currentUserLikes] = await Promise.all([
          prisma.reviewLike.groupBy({ by: ["reviewId"], where: { reviewId: { in: reviewIds } }, _count: { _all: true } }),
          prisma.comment.groupBy({ by: ["reviewId"], where: { reviewId: { in: reviewIds } }, _count: { _all: true } }),
          currentUserId ? prisma.reviewLike.findMany({ where: { reviewId: { in: reviewIds }, userId: currentUserId }, select: { reviewId: true } }) : [],
        ]);

        // Group by reviewId
        const likesMap = new Map<string, number>();
        const commentsCountMap = new Map<string, number>();

        reviewLikes.forEach((like) => likesMap.set(like.reviewId, like._count._all));

        reviewComments.forEach((comment) => commentsCountMap.set(comment.reviewId, comment._count._all));
        const likedReviewIds = new Set(currentUserLikes.map((like) => like.reviewId));

        // Authenticated user (already resolved at the beginning of the handler)

        enrichedReviews = reviewPage.items.map((r) => {
          return {
            ...r,
            favoriteTrack: favMap.get(r.userId) || null,
            likesCount: likesMap.get(r.id) || 0,
            commentsCount: commentsCountMap.get(r.id) || 0,
            likedByUser: currentUserId ? likedReviewIds.has(r.id) : false,
          };
        });
      }
    } catch (e) {
      console.error("Failed to query favorite track or interactive details:", e);
    }

    return NextResponse.json({
      ...item,
      reviews: enrichedReviews,
      reviewsNextCursor: reviewPage.nextCursor,
      reviewsHasNextPage: reviewPage.hasNextPage,
      reviewsLimit: reviewPage.limit,
      favoriteTrack,
      isListenLater,
      currentUserRating,
    });
  } catch (error) {
    if (error instanceof PaginationError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof DeezerError) {
      const response = deezerHttpError(error);
      return NextResponse.json(response.body, { status: response.status, headers: response.headers });
    }
    console.error("Fetch single music item error:", error);
    return NextResponse.json(
      { error: "Error al obtener detalles del álbum" },
      { status: 500 }
    );
  }
}
