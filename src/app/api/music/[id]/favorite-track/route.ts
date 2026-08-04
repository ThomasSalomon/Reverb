import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/services/db";
import { verifyToken } from "@/utils/auth";
import { MusicService } from "@/services/music";
import { parseFavoriteTrack } from "@/services/review-input";
import { readJsonObject, rejectUnknownFields, RequestBodyError } from "@/utils/request-body";

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
    const body = await readJsonObject(req);
    rejectUnknownFields(body, ["trackTitle"]);
    const trackTitle = parseFavoriteTrack(body.trackTitle);
    if (trackTitle === null) return NextResponse.json({ error: "trackTitle es requerido" }, { status: 400 });

    // 3. Ensure album exists locally (imports if not)
    const musicItem = await MusicService.getItemById(musicItemId);
    if (!musicItem) {
      return NextResponse.json(
        { error: "Álbum no encontrado" },
        { status: 404 }
      );
    }

    // 4. Save Favorite Track (upsert)
    const existing = await prisma.favoriteTrack.findFirst({
      where: {
        userId: authUser.userId,
        musicItemId,
      },
    });

    if (existing) {
      await prisma.favoriteTrack.update({
        where: { id: existing.id },
        data: { trackTitle },
      });
    } else {
      await prisma.favoriteTrack.create({
        data: {
          userId: authUser.userId,
          musicItemId,
          trackTitle,
        },
      });
    }

    return NextResponse.json({
      message: "Canción favorita guardada con éxito",
      favoriteTrack: trackTitle,
    });
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
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
      await prisma.favoriteTrack.deleteMany({
        where: {
          userId: authUser.userId,
          musicItemId,
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
