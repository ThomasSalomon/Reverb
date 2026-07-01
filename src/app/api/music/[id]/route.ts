import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { MusicService } from "@/services/music";
import { verifyToken } from "@/utils/auth";
import { prisma } from "@/services/db";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const item = await MusicService.getItemById(id);

    if (!item) {
      return NextResponse.json(
        { error: "Ítem musical no encontrado" },
        { status: 404 }
      );
    }

    // Check if current user has marked a favorite track on this album
    let favoriteTrack: string | null = null;
    let isListenLater = false;
    let currentUserRating: number | null = null;
    let enrichedReviews = item.reviews || [];
    try {
      const cookieStore = cookies();
      const token = cookieStore.get("token")?.value;
      if (token) {
        const authUser = await verifyToken(token);
        if (authUser) {
          const record = await prisma.favoriteTrack.findUnique({
            where: {
              userId_musicItemId: {
                userId: authUser.userId,
                musicItemId: id,
              },
            },
            select: { trackTitle: true },
          });
          favoriteTrack = record?.trackTitle || null;

          const listenLaterRecord = await prisma.listenLater.findUnique({
            where: {
              userId_musicItemId: {
                userId: authUser.userId,
                musicItemId: id,
              },
            },
            select: { userId: true },
          });
          isListenLater = !!listenLaterRecord;

          const ratingRecord = await prisma.rating.findUnique({
            where: {
              userId_musicItemId: {
                userId: authUser.userId,
                musicItemId: id,
              },
            },
            select: { value: true },
          });
          currentUserRating = ratingRecord?.value || null;
        }
      }

      // Fetch favorite tracks for all authors of the reviews on this album
      const reviewUserIds = (item.reviews || []).map((r: any) => r.userId);
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
        const favMap = new Map(favTracks.map((ft) => [ft.userId, ft.trackTitle]));
        
        // Fetch likes and comments count
        const reviewIds = (item.reviews || []).map((r: any) => r.id);
        const reviewLikes = await prisma.reviewLike.findMany({
          where: { reviewId: { in: reviewIds } },
          select: { reviewId: true, userId: true },
        });
        const reviewComments = await prisma.comment.findMany({
          where: { reviewId: { in: reviewIds } },
          select: { reviewId: true },
        });

        // Group by reviewId
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

        // Authenticated user
        let currentUserId: string | null = null;
        const cookieStore = cookies();
        const token = cookieStore.get("token")?.value;
        if (token) {
          const authUser = await verifyToken(token);
          if (authUser) currentUserId = authUser.userId;
        }

        enrichedReviews = (item.reviews || []).map((r: any) => {
          const likesList = likesMap.get(r.id) || [];
          return {
            ...r,
            favoriteTrack: favMap.get(r.userId) || null,
            likesCount: likesList.length,
            commentsCount: commentsCountMap.get(r.id) || 0,
            likedByUser: currentUserId ? likesList.includes(currentUserId) : false,
          };
        });
      }
    } catch (e) {
      console.error("Failed to query favorite track or interactive details:", e);
    }

    return NextResponse.json({
      ...item,
      reviews: enrichedReviews,
      favoriteTrack,
      isListenLater,
      currentUserRating,
    });
  } catch (error) {
    console.error("Fetch single music item error:", error);
    return NextResponse.json(
      { error: "Error al obtener detalles del álbum" },
      { status: 500 }
    );
  }
}
