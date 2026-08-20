import { NextResponse } from "next/server";
import { resolveAuthUser } from "@/utils/auth";
import { prisma } from "@/services/db";
import { parseUpdateReviewInput } from "@/services/review-input";
import { authorizeReviewUpdate, updateReview } from "@/services/reviews";
import { readJsonObject } from "@/utils/request-body";
import { routeErrorResponse } from "@/utils/http-errors";
import {
  invalidateUserRecapCache,
  invalidateUserStatsCache,
} from "@/services/user-derived-cache";

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await resolveAuthUser(request);
    if (!auth.ok) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const user = auth.user;

    const reviewId = params.id;

    // Check if review exists and belongs to user
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      return NextResponse.json(
        { error: "Reseña no encontrada" },
        { status: 404 }
      );
    }

    if (review.userId !== user.userId) {
      return NextResponse.json(
        { error: "No tienes permiso para eliminar esta reseña" },
        { status: 403 }
      );
    }

    // Delete review
    // This will also delete associated comments and likes because of Cascade delete in prisma schema
    await prisma.review.delete({
      where: { id: reviewId },
    });

    invalidateUserStatsCache(user.userId);
    invalidateUserRecapCache(user.userId, review.createdAt.getUTCFullYear());

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Delete review error:", error);
    return NextResponse.json(
      { error: "Error al eliminar la reseña" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await resolveAuthUser(request);
    if (!auth.ok) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const reviewId = params.id;
    const reviewContext = await authorizeReviewUpdate(auth.user, reviewId);
    const input = parseUpdateReviewInput(await readJsonObject(request));
    const { review: updatedReview, originalCreatedAt, favoriteTrack } = await updateReview(
      auth.user,
      reviewContext,
      input,
    );

    // Content and favorite-track changes do not participate in these aggregates.
    if (input.ratingValue !== undefined) {
      invalidateUserStatsCache(auth.user.userId);
      invalidateUserRecapCache(auth.user.userId, originalCreatedAt.getUTCFullYear());
    } else if (input.tags !== undefined) {
      invalidateUserRecapCache(auth.user.userId, originalCreatedAt.getUTCFullYear());
    }

    return NextResponse.json({
      success: true,
      review: {
        ...updatedReview,
        favoriteTrack,
      }
    }, { status: 200 });

  } catch (error) {
    return routeErrorResponse(error, {
      operation: "Patch review error:",
      fallbackMessage: "Error al modificar la reseña",
    });
  }
}
