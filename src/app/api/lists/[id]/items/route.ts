import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/services/db";
import { verifyToken } from "@/utils/auth";
import { MusicService } from "@/services/music";

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
    const listId = params.id;
    const authUser = await getAuthUser();
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

    const { musicItemId } = await req.json();
    if (!musicItemId) {
      return NextResponse.json(
        { error: "musicItemId es requerido" },
        { status: 400 }
      );
    }

    // 2. Ensure item is imported/cached locally
    const musicItem = await MusicService.getItemById(musicItemId);
    if (!musicItem) {
      return NextResponse.json(
        { error: "Álbum no encontrado en el catálogo" },
        { status: 404 }
      );
    }

    // 3. Check if already exists in list to prevent duplicate unique constraint error
    const existing = await prisma.listItem.findUnique({
      where: {
        listId_musicItemId: {
          listId,
          musicItemId,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "El álbum ya está en la lista" },
        { status: 400 }
      );
    }

    // 4. Create list item
    // Count current items to calculate order index
    const count = await prisma.listItem.count({ where: { listId } });

    if (count >= 100) {
      return NextResponse.json(
        { error: "La lista ha alcanzado el límite máximo de 100 álbumes." },
        { status: 403 }
      );
    }

    const newListItem = await prisma.listItem.create({
      data: {
        listId,
        musicItemId,
        order: count,
      },
      include: {
        musicItem: true,
      },
    });

    return NextResponse.json(newListItem, { status: 201 });
  } catch (error) {
    console.error("POST list item error:", error);
    return NextResponse.json(
      { error: "Error al añadir álbum a la lista" },
      { status: 500 }
    );
  }
}
