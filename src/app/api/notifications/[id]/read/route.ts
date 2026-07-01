import { NextResponse } from "next/server";
import { prisma } from "@/services/db";
import { getAuthUser } from "@/utils/auth";

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = params;
    
    // If id is "all", mark all as read
    if (id === "all") {
      await prisma.notification.updateMany({
        where: { userId: authUser.userId, isRead: false },
        data: { isRead: true },
      });
      return NextResponse.json({ message: "Todas las notificaciones marcadas como leídas" });
    }

    const notification = await prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      return NextResponse.json({ error: "Notificación no encontrada" }, { status: 404 });
    }

    if (notification.userId !== authUser.userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT notification read error:", error);
    return NextResponse.json(
      { error: "Error al marcar notificación como leída" },
      { status: 500 }
    );
  }
}
