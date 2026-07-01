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

    // Ensure review exists
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      select: { id: true, userId: true, musicItemId: true },
    });

    if (!review) {
      return NextResponse.json(
        { error: "Reseña no encontrada" },
        { status: 404 }
      );
    }

    // Create like (upsert style or create ignoring unique constraint)
    try {
      await prisma.reviewLike.create({
        data: {
          userId: authUser.userId,
          reviewId,
        },
      });

      if (review.userId !== authUser.userId) {
        await prisma.notification.create({
          data: {
            userId: review.userId,
            sourceUserId: authUser.userId,
            type: "NEW_LIKE",
            message: `${authUser.username} le ha dado like a tu reseña.`,
            link: `/albums/${review.musicItemId}`
          }
        });
      }
    } catch (e: any) {
      // P2002 Unique constraint failed (already liked). Ignore
      if (e.code !== "P2002") {
        throw e;
      }
    }

    return NextResponse.json({ message: "Reseña gustada con éxito" });
  } catch (error) {
    console.error("POST like error:", error);
    return NextResponse.json(
      { error: "Error al registrar like" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const reviewId = params.id;
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    try {
      await prisma.reviewLike.delete({
        where: {
          userId_reviewId: {
            userId: authUser.userId,
            reviewId,
          },
        },
      });
    } catch (e: any) {
      if (e.code !== "P2025") {
        throw e;
      }
    }

    return NextResponse.json({ message: "Like removido con éxito" });
  } catch (error) {
    console.error("DELETE like error:", error);
    return NextResponse.json(
      { error: "Error al remover like" },
      { status: 500 }
    );
  }
}
