import { NextResponse } from "next/server";
import { prisma } from "@/services/db";
import { getAuthUser } from "@/utils/auth";

export async function GET(req: Request) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const unreadOnly = searchParams.get("unreadOnly") === "true";

    const whereClause: any = { userId: authUser.userId };
    if (unreadOnly) {
      whereClause.isRead = false;
    }

    const notifications = await prisma.notification.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        user: { select: { username: true, profileImage: true, profileColor: true } }
      }
    });

    // For source user details
    const enrichedNotifications = await Promise.all(
      notifications.map(async (n) => {
        let sourceUser = null;
        if (n.sourceUserId) {
          sourceUser = await prisma.user.findUnique({
            where: { id: n.sourceUserId },
            select: { username: true, profileImage: true, profileColor: true }
          });
        }
        return {
          ...n,
          sourceUser
        };
      })
    );

    const unreadCount = await prisma.notification.count({
      where: { userId: authUser.userId, isRead: false },
    });

    return NextResponse.json({
      notifications: enrichedNotifications,
      unreadCount,
    });
  } catch (error) {
    console.error("GET notifications error:", error);
    return NextResponse.json(
      { error: "Error al obtener notificaciones" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    await prisma.notification.deleteMany({
      where: { userId: authUser.userId }
    });

    return NextResponse.json({ message: "Todas las notificaciones han sido eliminadas" });
  } catch (error) {
    console.error("DELETE notifications error:", error);
    return NextResponse.json(
      { error: "Error al eliminar notificaciones" },
      { status: 500 }
    );
  }
}
