import { NextResponse } from "next/server";
import { getAuthUser } from "@/utils/auth";
import { prisma } from "@/utils/db";

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
