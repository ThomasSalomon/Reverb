import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/services/db";
import { verifyToken } from "@/utils/auth";

export const dynamic = "force-dynamic";

async function getAuthUser() {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) return null;
    return await verifyToken(token);
  } catch {
    return null;
  }
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const reviewId = params.id;
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { content } = await req.json();
    if (!content || typeof content !== "string" || content.trim() === "") {
      return NextResponse.json(
        { error: "El contenido del comentario es requerido" },
        { status: 400 }
      );
    }

    const commentContent = content.trim().substring(0, 500);

    const comment = await prisma.comment.create({
      data: {
        content: commentContent,
        userId: authUser.userId,
        reviewId,
      },
      include: {
        user: {
          select: {
            username: true,
            profileColor: true,
            profileImage: true,
          },
        },
      },
    });

    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      select: { userId: true, musicItemId: true }
    });

    if (review && review.userId !== authUser.userId) {
      await prisma.notification.create({
        data: {
          userId: review.userId,
          sourceUserId: authUser.userId,
          type: "NEW_COMMENT",
          message: `${authUser.username} ha comentado en tu reseña.`,
          link: `/albums/${review.musicItemId}`
        }
      });
    }

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error("POST comment error:", error);
    return NextResponse.json(
      { error: "Error al agregar comentario" },
      { status: 500 }
    );
  }
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const reviewId = params.id;

    const comments = await prisma.comment.findMany({
      where: { reviewId },
      orderBy: {
        createdAt: "asc",
      },
      include: {
        user: {
          select: {
            username: true,
            profileColor: true,
            profileImage: true,
          },
        },
      },
    });

    return NextResponse.json(comments);
  } catch (error) {
    console.error("GET comments error:", error);
    return NextResponse.json(
      { error: "Error al obtener comentarios" },
      { status: 500 }
    );
  }
}
