import { NextResponse } from "next/server";
import { resolveAuthUser } from "@/utils/auth";
import { prisma } from "@/services/db";
import { parseRatingValue, RatingError, RatingService } from "@/services/ratings";
import { normalizeReviewTagsForStorage } from "@/utils/review-tags";

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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "El cuerpo debe contener JSON válido" },
        { status: 400 },
      );
    }
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json(
        { error: "El cuerpo debe ser un objeto JSON" },
        { status: 400 },
      );
    }
    const { content, ratingValue, tags, favoriteTrack } = body as Record<string, unknown>;

    // Validations
    let numericRating: number | undefined = undefined;
    if (ratingValue !== undefined) {
      numericRating = parseRatingValue(ratingValue);
    }

    if (content !== undefined && (typeof content !== "string" || !content.trim())) {
      return NextResponse.json(
        { error: "El contenido de la reseña no puede estar vacío" },
        { status: 400 }
      );
    }

    if (
      favoriteTrack !== undefined &&
      favoriteTrack !== null &&
      typeof favoriteTrack !== "string"
    ) {
      return NextResponse.json(
        { error: "La canción favorita debe ser texto" },
        { status: 400 },
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
          content: typeof content === "string" ? content.trim() : undefined,
          ratingValue: numericRating !== undefined ? numericRating : undefined,
          tags: tags !== undefined ? validTags : undefined,
        },
      });

      if (numericRating !== undefined) {
        await RatingService.setCurrent(
          { userId, musicItemId, value: numericRating },
          tx,
        );
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
    if (error instanceof RatingError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Patch review error:", error);
    return NextResponse.json(
      { error: "Error al modificar la reseña" },
      { status: 500 }
    );
  }
}
