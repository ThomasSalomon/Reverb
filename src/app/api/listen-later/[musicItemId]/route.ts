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

export async function DELETE(
  req: Request,
  { params }: { params: { musicItemId: string } }
) {
  try {
    const { musicItemId } = params;
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    try {
      await prisma.listenLater.delete({
        where: {
          userId_musicItemId: {
            userId: authUser.userId,
            musicItemId,
          },
        },
      });
    } catch (e: any) {
      if (e.code !== "P2025") {
        throw e;
      }
    }

    return NextResponse.json({ message: "Álbum eliminado de la lista de deseos con éxito" });
  } catch (error) {
    console.error("DELETE listen-later error:", error);
    return NextResponse.json(
      { error: "Error al eliminar de la lista de deseos" },
      { status: 500 }
    );
  }
}
