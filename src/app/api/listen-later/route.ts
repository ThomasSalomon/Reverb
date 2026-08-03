import { NextResponse } from "next/server";
import { prisma } from "@/services/db";
import { resolveAuthUser } from "@/utils/auth";
import { MusicService } from "@/services/music";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const auth = await resolveAuthUser(req);
    if (!auth.ok) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { musicItemId } = await req.json();
    if (!musicItemId) {
      return NextResponse.json(
        { error: "musicItemId es requerido" },
        { status: 400 }
      );
    }

    // Ensure item is cached locally
    const musicItem = await MusicService.getItemById(musicItemId);
    if (!musicItem) {
      return NextResponse.json(
        { error: "Álbum no encontrado en el catálogo" },
        { status: 404 }
      );
    }

    try {
      await prisma.listenLater.create({
        data: {
          userId: auth.user.userId,
          musicItemId,
        },
      });
    } catch (e: any) {
      // P2002 Unique constraint failed (already on list)
      if (e.code !== "P2002") {
        throw e;
      }
    }

    return NextResponse.json({ message: "Álbum guardado para después" }, { status: 201 });
  } catch (error) {
    console.error("POST listen-later error:", error);
    return NextResponse.json(
      { error: "Error al registrar en la lista de deseos" },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const auth = await resolveAuthUser(req);
    if (!auth.ok) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const list = await prisma.listenLater.findMany({
      where: { userId: auth.user.userId },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        musicItemId: true,
        musicItem: {
          select: {
            id: true,
            title: true,
            artist: true,
            coverUrl: true,
          },
        },
      },
    });

    return NextResponse.json(list);
  } catch (error) {
    console.error("GET listen-later logs error:", error);
    return NextResponse.json(
      { error: "Error al obtener la lista de deseos" },
      { status: 500 }
    );
  }
}
