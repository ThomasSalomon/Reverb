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

export async function POST(req: Request) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
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
          userId: authUser.userId,
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
    const { searchParams } = new URL(req.url);
    const username = searchParams.get("username");
    const authUser = await getAuthUser();

    let targetUserId = authUser?.userId;

    if (username) {
      const user = await prisma.user.findUnique({
        where: { username },
        select: { id: true },
      });
      if (!user) {
        return NextResponse.json(
          { error: "Usuario no encontrado" },
          { status: 404 }
        );
      }
      targetUserId = user.id;
    }

    if (!targetUserId) {
      return NextResponse.json(
        { error: "Identificación de usuario requerida" },
        { status: 400 }
      );
    }

    const list = await prisma.listenLater.findMany({
      where: { userId: targetUserId },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        musicItem: true,
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
