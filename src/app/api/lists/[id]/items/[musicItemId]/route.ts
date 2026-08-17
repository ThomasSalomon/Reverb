import { NextResponse } from "next/server";
import { prisma } from "@/services/db";
import { getAuthUser } from "@/utils/auth";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: Request,
  { params }: { params: { id: string; musicItemId: string } }
) {
  try {
    const listId = params.id;
    const { musicItemId } = params;

    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // 1. Verify list ownership
    const list = await prisma.list.findUnique({
      where: { id: listId },
      select: { userId: true },
    });

    if (!list) {
      return NextResponse.json(
        { error: "Lista no encontrada" },
        { status: 404 }
      );
    }

    if (list.userId !== authUser.userId) {
      return NextResponse.json(
        { error: "No autorizado para modificar esta lista" },
        { status: 403 }
      );
    }

    // 2. Delete item
    try {
      await prisma.listItem.delete({
        where: {
          listId_musicItemId: {
            listId,
            musicItemId,
          },
        },
      });
    } catch (e: any) {
      if (e.code !== "P2025") {
        throw e;
      }
    }

    return NextResponse.json({ message: "Álbum eliminado de la lista con éxito" });
  } catch (error) {
    console.error("DELETE list item error:", error);
    return NextResponse.json(
      { error: "Error al eliminar álbum de la lista" },
      { status: 500 }
    );
  }
}
