import { NextResponse } from "next/server";
import { resolveAuthUser } from "@/utils/auth";
import { prisma } from "@/services/db";
import { RatingService } from "@/services/ratings";
import { isReviewInputError, parseUpdateReviewInput } from "@/services/review-input";
import { readJsonObject } from "@/utils/request-body";

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
        { error: "No tienes permiso para modificar esta reseña" },
        { status: 403 }
      );
    }

    const input = parseUpdateReviewInput(await readJsonObject(request));

    const musicItemId = review.musicItemId;
    const userId = user.userId;

    // Update using an interactive transaction to keep Review and Rating in sync
    const updatedReview = await prisma.$transaction(async (tx) => {
      const updated = await tx.review.update({
        where: { id: reviewId },
        data: {
          content: input.content,
          ratingValue: input.ratingValue,
          tags: input.tags,
        },
      });

      if (input.ratingValue !== undefined) {
        await RatingService.setCurrent(
          { userId, musicItemId, value: input.ratingValue },
          tx,
        );
      }

      if (input.favoriteTrack !== undefined) {
        if (input.favoriteTrack === null) {
          try {
            await tx.favoriteTrack.deleteMany({
              where: {
                userId,
                musicItemId,
              },
            });
          } catch (e: any) {
            // P2025 is Prisma's error for record to delete not found
            if (e.code !== "P2025") throw e;
          }
        } else {
          const existingFav = await tx.favoriteTrack.findFirst({
            where: {
              userId,
              musicItemId,
            },
          });
          
          if (existingFav) {
            await tx.favoriteTrack.update({
              where: { id: existingFav.id },
              data: { trackTitle: input.favoriteTrack },
            });
          } else {
            await tx.favoriteTrack.create({
              data: {
                userId,
                musicItemId,
                trackTitle: input.favoriteTrack,
              },
            });
          }
        }
      }

      return updated;
    });

    return NextResponse.json({
      success: true,
      review: {
        ...updatedReview,
        favoriteTrack: input.favoriteTrack,
      }
    }, { status: 200 });

  } catch (error) {
    if (isReviewInputError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Patch review error:", error);
    return NextResponse.json(
      { error: "Error al modificar la reseña" },
      { status: 500 }
    );
  }
}
