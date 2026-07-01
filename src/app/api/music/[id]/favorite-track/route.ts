import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/services/db";
import { verifyToken } from "@/utils/auth";
import { MusicService } from "@/services/music";

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
  { params }: { params: { id: string } }
) {
  try {
    const musicItemId = params.id;

    // 1. Authenticate
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // 2. Validate input
    const { trackTitle } = await req.json();
    if (!trackTitle || typeof trackTitle !== "string") {
      return NextResponse.json(
        { error: "trackTitle es requerido" },
        { status: 400 }
      );
    }

    // 3. Ensure album exists locally (imports if not)
    const musicItem = await MusicService.getItemById(musicItemId);
    if (!musicItem) {
      return NextResponse.json(
        { error: "Álbum no encontrado" },
        { status: 404 }
      );
    }

    // 4. Save Favorite Track (upsert)
    await prisma.favoriteTrack.upsert({
      where: {
        userId_musicItemId: {
          userId: authUser.userId,
          musicItemId,
        },
      },
      create: {
        userId: authUser.userId,
        musicItemId,
        trackTitle,
      },
      update: {
        trackTitle,
      },
    });

    return NextResponse.json({
      message: "Canción favorita guardada con éxito",
      favoriteTrack: trackTitle,
    });
  } catch (error) {
    console.error("POST favorite track error:", error);
    return NextResponse.json(
      { error: "Error al guardar canción favorita" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const musicItemId = params.id;

    // 1. Authenticate
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // 2. Delete Favorite Track
    try {
      await prisma.favoriteTrack.delete({
        where: {
          userId_musicItemId: {
            userId: authUser.userId,
            musicItemId,
          },
        },
      });
    } catch (e: any) {
      // P2025 is Prisma's error for record to delete not found. Ignore if already deleted
      if (e.code !== "P2025") {
        throw e;
      }
    }

    return NextResponse.json({
      message: "Canción favorita eliminada con éxito",
    });
  } catch (error) {
    console.error("DELETE favorite track error:", error);
    return NextResponse.json(
      { error: "Error al eliminar canción favorita" },
      { status: 500 }
    );
  }
}
