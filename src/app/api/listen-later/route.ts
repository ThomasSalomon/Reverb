import { NextResponse } from "next/server";
import { prisma } from "@/services/db";
import { resolveAuthUser } from "@/utils/auth";
import { MusicService } from "@/services/music";
import { parseMusicItemId, RatingError } from "@/services/ratings";
import { readJsonObject, rejectUnknownFields, RequestBodyError } from "@/utils/request-body";
import { descendingTemporalWhere, getPageLimit, pageResult, PaginationError, temporalCursor } from "@/utils/cursor-pagination";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const auth = await resolveAuthUser(req);
    if (!auth.ok) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await readJsonObject(req);
    rejectUnknownFields(body, ["musicItemId"]);
    const musicItemId = parseMusicItemId(body.musicItemId);

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
    if (error instanceof RequestBodyError || error instanceof RatingError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
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

    const searchParams = new URL(req.url).searchParams;
    const limit = getPageLimit(searchParams);
    const cursor = temporalCursor(searchParams);
    const list = await prisma.listenLater.findMany({
      where: { userId: auth.user.userId, ...(cursor ? { OR: descendingTemporalWhere(cursor) } : {}) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      select: {
        id: true,
        createdAt: true,
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

    return NextResponse.json(pageResult(list, limit, "createdAt"));
  } catch (error) {
    if (error instanceof PaginationError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("GET listen-later logs error:", error);
    return NextResponse.json(
      { error: "Error al obtener la lista de deseos" },
      { status: 500 }
    );
  }
}
