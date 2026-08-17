import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/services/db";
import { RatingService } from "@/services/ratings";
import type { CreateReviewInput, UpdateReviewInput } from "@/services/review-input";
import { AppError } from "@/utils/errors";

const MAX_REVIEWS_PER_DAY = 20;

type ReviewSummarySource = Readonly<{
  id: string;
  userId: string;
  musicItemId: string;
}>;

export async function enrichReviewSummaries<T extends ReviewSummarySource>(
  reviews: readonly T[],
  currentUserId: string | null,
  client: PrismaClient = prisma,
): Promise<Array<T & {
  favoriteTrack: string | null;
  likesCount: number;
  commentsCount: number;
  likedByUser: boolean;
}>> {
  if (reviews.length === 0) return [];

  const reviewIds = reviews.map((review) => review.id);
  const userMusicPairs = reviews.map((review) => ({
    userId: review.userId,
    musicItemId: review.musicItemId,
  }));
  const [favoriteTracks, reviewLikes, reviewComments, currentUserLikes] =
    await Promise.all([
      client.favoriteTrack.findMany({
        where: { OR: userMusicPairs },
        select: { userId: true, musicItemId: true, trackTitle: true },
      }),
      client.reviewLike.groupBy({
        by: ["reviewId"],
        where: { reviewId: { in: reviewIds } },
        _count: { _all: true },
      }),
      client.comment.groupBy({
        by: ["reviewId"],
        where: { reviewId: { in: reviewIds } },
        _count: { _all: true },
      }),
      currentUserId
        ? client.reviewLike.findMany({
            where: { reviewId: { in: reviewIds }, userId: currentUserId },
            select: { reviewId: true },
          })
        : [],
    ]);

  const favoriteTrackByUserItem = new Map(
    favoriteTracks.map((track) => [
      `${track.userId}_${track.musicItemId}`,
      track.trackTitle,
    ]),
  );
  const likesByReview = new Map(
    reviewLikes.map((entry) => [entry.reviewId, entry._count._all]),
  );
  const commentsByReview = new Map(
    reviewComments.map((entry) => [entry.reviewId, entry._count._all]),
  );
  const likedReviewIds = new Set(currentUserLikes.map((like) => like.reviewId));

  return reviews.map((review) => ({
    ...review,
    favoriteTrack:
      favoriteTrackByUserItem.get(`${review.userId}_${review.musicItemId}`) ?? null,
    likesCount: likesByReview.get(review.id) ?? 0,
    commentsCount: commentsByReview.get(review.id) ?? 0,
    likedByUser: currentUserId ? likedReviewIds.has(review.id) : false,
  }));
}

function isPrismaError(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}

export async function createReview(
  actor: { userId: string },
  input: CreateReviewInput,
  client: PrismaClient = prisma,
) {
  const since = new Date();
  since.setDate(since.getDate() - 1);

  const recentReviewsCount = await client.review.count({
    where: { userId: actor.userId, createdAt: { gte: since } },
  });
  if (recentReviewsCount >= MAX_REVIEWS_PER_DAY) {
    throw new AppError(
      "Rate limit exceeded: Has alcanzado el límite de 20 reseñas por día.",
      429,
      "REVIEW_RATE_LIMITED",
    );
  }

  const result = await client.$transaction(async (tx) => {
    const rating = await RatingService.setCurrent(
      {
        userId: actor.userId,
        musicItemId: input.musicItemId,
        value: input.ratingValue,
      },
      tx,
    );
    const review = await tx.review.create({
      data: {
        userId: actor.userId,
        musicItemId: input.musicItemId,
        content: input.content,
        ratingValue: input.ratingValue,
        tags: input.tags,
      },
    });
    return { review, rating };
  });

  const reviewsCount = await client.review.count({ where: { userId: actor.userId } });
  if (reviewsCount === 1) {
    try {
      await client.earnedBadge.create({
        data: { userId: actor.userId, badgeId: "FIRST_REVIEW" },
      });
      const user = await client.user.findUnique({
        where: { id: actor.userId },
        select: { username: true },
      });
      await client.notification.create({
        data: {
          userId: actor.userId,
          type: "NEW_BADGE",
          message: "¡Has obtenido el logro 'Crítico en Ascenso' por tu primera reseña!",
          link: `/users/${user?.username || actor.userId}`,
        },
      });
    } catch (error) {
      if (!isPrismaError(error, "P2002")) {
        console.error("Error awarding badge:", error);
      }
    }
  }

  return result;
}

export async function authorizeReviewUpdate(
  actor: { userId: string },
  reviewId: string,
  client: PrismaClient = prisma,
) {
  const existing = await client.review.findUnique({ where: { id: reviewId } });
  if (!existing) {
    throw new AppError("Reseña no encontrada", 404, "REVIEW_NOT_FOUND");
  }
  if (existing.userId !== actor.userId) {
    throw new AppError(
      "No tienes permiso para modificar esta reseña",
      403,
      "REVIEW_FORBIDDEN",
    );
  }
  return existing;
}

export async function updateReview(
  actor: { userId: string },
  existing: Awaited<ReturnType<typeof authorizeReviewUpdate>>,
  input: UpdateReviewInput,
  client: PrismaClient = prisma,
) {
  const review = await client.$transaction(async (tx) => {
    const updated = await tx.review.update({
      where: { id: existing.id },
      data: {
        content: input.content,
        ratingValue: input.ratingValue,
        tags: input.tags,
      },
    });

    if (input.ratingValue !== undefined) {
      await RatingService.setCurrent(
        {
          userId: actor.userId,
          musicItemId: existing.musicItemId,
          value: input.ratingValue,
        },
        tx,
      );
    }

    if (input.favoriteTrack === null) {
      await tx.favoriteTrack.deleteMany({
        where: { userId: actor.userId, musicItemId: existing.musicItemId },
      });
    } else if (input.favoriteTrack !== undefined) {
      const favorite = await tx.favoriteTrack.findFirst({
        where: { userId: actor.userId, musicItemId: existing.musicItemId },
        select: { id: true },
      });
      if (favorite) {
        await tx.favoriteTrack.update({
          where: { id: favorite.id },
          data: { trackTitle: input.favoriteTrack },
        });
      } else {
        await tx.favoriteTrack.create({
          data: {
            userId: actor.userId,
            musicItemId: existing.musicItemId,
            trackTitle: input.favoriteTrack,
          },
        });
      }
    }

    return updated;
  });

  return { review, originalCreatedAt: existing.createdAt };
}
