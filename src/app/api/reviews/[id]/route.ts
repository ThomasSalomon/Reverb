import { NextResponse } from "next/server";
import { getAuthUser } from "@/utils/auth";
import { prisma } from "@/services/db";
import { normalizeReviewTagsForStorage } from "@/utils/review-tags";

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

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
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

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

    const { content, ratingValue, tags, favoriteTrack } = await request.json();

    // Validations
    let numericRating: number | undefined = undefined;
    if (ratingValue !== undefined) {
      numericRating = parseFloat(ratingValue);
      if (isNaN(numericRating) || numericRating < 1 || numericRating > 5 || numericRating % 0.5 !== 0) {
        return NextResponse.json(
          { error: "Calificación inválida. Debe ser entre 1 y 5 con incrementos de 0.5" },
          { status: 400 }
        );
      }
    }

    if (content !== undefined && !content.trim()) {
      return NextResponse.json(
        { error: "El contenido de la reseña no puede estar vacío" },
        { status: 400 }
      );
    }

    const validTags = tags !== undefined ? normalizeReviewTagsForStorage(tags) : null;

    const musicItemId = review.musicItemId;
    const userId = user.userId;

    // Update using an interactive transaction to keep Review and Rating in sync
    const updatedReview = await prisma.$transaction(async (tx) => {
      const updated = await tx.review.update({
        where: { id: reviewId },
        data: {
          content: content !== undefined ? content.trim() : undefined,
          ratingValue: numericRating !== undefined ? numericRating : undefined,
          tags: tags !== undefined ? validTags : undefined,
        },
      });

      if (numericRating !== undefined) {
        await tx.rating.updateMany({
          where: {
            userId,
            musicItemId,
          },
          data: {
            value: numericRating,
          },
        });
      }

      if (favoriteTrack !== undefined) {
        if (favoriteTrack === null || favoriteTrack.trim() === "") {
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
              data: { trackTitle: favoriteTrack.trim() },
            });
          } else {
            await tx.favoriteTrack.create({
              data: {
                userId,
                musicItemId,
                trackTitle: favoriteTrack.trim(),
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
        favoriteTrack: favoriteTrack !== undefined ? (favoriteTrack || null) : undefined,
      }
    }, { status: 200 });

  } catch (error) {
    console.error("Patch review error:", error);
    return NextResponse.json(
      { error: "Error al modificar la reseña" },
      { status: 500 }
    );
  }
}
