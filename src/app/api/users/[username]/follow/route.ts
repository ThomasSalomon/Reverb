import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/services/db";
import { verifyToken } from "@/utils/auth";

export const dynamic = "force-dynamic";

// Helper to authenticate request
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
  { params }: { params: { username: string } }
) {
  try {
    const { username } = params;

    // 1. Authenticate
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // 2. Prevent self-following
    if (authUser.username === username) {
      return NextResponse.json(
        { error: "No puedes seguirte a ti mismo" },
        { status: 400 }
      );
    }

    // 3. Find target user
    const targetUser = await prisma.user.findUnique({
      where: { username },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: "Usuario a seguir no encontrado" },
        { status: 404 }
      );
    }

    // 4. Create Follow (using upsert to avoid duplicate key errors)
    const follow = await prisma.follow.upsert({
      where: {
        followerId_followingId: {
          followerId: authUser.userId,
          followingId: targetUser.id,
        },
      },
      create: {
        followerId: authUser.userId,
        followingId: targetUser.id,
      },
      update: {}, // Do nothing if already following
    });

    // 5. Create notification if not already following
    if (follow) {
      await prisma.notification.create({
        data: {
          userId: targetUser.id,
          sourceUserId: authUser.userId,
          type: "NEW_FOLLOWER",
          message: `${authUser.username} ha comenzado a seguirte.`,
          link: `/users/${authUser.username}`
        }
      });
    }

    return NextResponse.json({
      message: `Ahora sigues a ${username}`,
    });
  } catch (error) {
    console.error("POST follow error:", error);
    return NextResponse.json(
      { error: "Error al realizar acción de seguimiento" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { username: string } }
) {
  try {
    const { username } = params;

    // 1. Authenticate
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // 2. Find target user
    const targetUser = await prisma.user.findUnique({
      where: { username },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: "Usuario a dejar de seguir no encontrado" },
        { status: 404 }
      );
    }

    // 3. Delete Follow
    try {
      await prisma.follow.delete({
        where: {
          followerId_followingId: {
            followerId: authUser.userId,
            followingId: targetUser.id,
          },
        },
      });
    } catch (e: any) {
      // Prisma throws P2025 if record doesn't exist. Ignore if already not following
      if (e.code !== "P2025") {
        throw e;
      }
    }

    return NextResponse.json({
      message: `Has dejado de seguir a ${username}`,
    });
  } catch (error) {
    console.error("DELETE follow error:", error);
    return NextResponse.json(
      { error: "Error al dejar de seguir" },
      { status: 500 }
    );
  }
}
