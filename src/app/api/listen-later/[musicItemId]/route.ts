import { NextResponse } from "next/server";
import { prisma } from "@/services/db";
import { resolveAuthUser } from "@/utils/auth";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: Request,
  { params }: { params: { musicItemId: string } }
) {
  try {
    const { musicItemId } = params;
    const auth = await resolveAuthUser(req);
    if (!auth.ok) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    try {
      await prisma.listenLater.deleteMany({
        where: {
          userId: auth.user.userId,
          musicItemId,
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
