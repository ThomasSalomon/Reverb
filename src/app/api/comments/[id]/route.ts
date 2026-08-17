import { NextResponse } from "next/server";
import { prisma } from "@/services/db";
import { getAuthUser } from "@/utils/auth";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const commentId = params.id;
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Find comment and include its review owner id
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        review: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!comment) {
      return NextResponse.json(
        { error: "Comentario no encontrado" },
        { status: 404 }
      );
    }

    // Only comment owner or review owner can delete comments
    const isCommentOwner = comment.userId === authUser.userId;
    const isReviewOwner = comment.review.userId === authUser.userId;

    if (!isCommentOwner && !isReviewOwner) {
      return NextResponse.json(
        { error: "No autorizado para eliminar este comentario" },
        { status: 403 }
      );
    }

    await prisma.comment.delete({
      where: { id: commentId },
    });

    return NextResponse.json({ message: "Comentario eliminado con éxito" });
  } catch (error) {
    console.error("DELETE comment error:", error);
    return NextResponse.json(
      { error: "Error al eliminar comentario" },
      { status: 500 }
    );
  }
}
