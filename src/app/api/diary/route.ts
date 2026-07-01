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

    const { musicItemId, listenedAt, ratingValue, notes } = await req.json();

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

    const loggedDate = listenedAt ? new Date(listenedAt) : new Date();

    const existingLog = await prisma.diaryLog.findUnique({
      where: {
        userId_musicItemId: {
          userId: authUser.userId,
          musicItemId,
        },
      },
    });

    let resultLog;
    if (existingLog) {
      resultLog = await prisma.diaryLog.update({
        where: { id: existingLog.id },
        data: {
          listenedAt: loggedDate,
          ratingValue: ratingValue ? parseFloat(ratingValue) : null,
          notes: notes ? notes.trim().substring(0, 500) : null,
          listenCount: { increment: 1 },
        },
        include: {
          musicItem: true,
        },
      });
    } else {
      resultLog = await prisma.diaryLog.create({
        data: {
          userId: authUser.userId,
          musicItemId,
          listenedAt: loggedDate,
          ratingValue: ratingValue ? parseFloat(ratingValue) : null,
          notes: notes ? notes.trim().substring(0, 500) : null,
          listenCount: 1,
        },
        include: {
          musicItem: true,
        },
      });
    }

    return NextResponse.json(resultLog, { status: existingLog ? 200 : 201 });
  } catch (error) {
    console.error("POST diary log error:", error);
    return NextResponse.json(
      { error: "Error al registrar en la bitácora" },
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

    const logs = await prisma.diaryLog.findMany({
      where: { userId: targetUserId },
      orderBy: {
        listenedAt: "desc",
      },
      include: {
        musicItem: {
          select: {
            id: true,
            title: true,
            artist: true,
            coverUrl: true,
            type: true,
          },
        },
      },
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error("GET diary logs error:", error);
    return NextResponse.json(
      { error: "Error al obtener la bitácora" },
      { status: 500 }
    );
  }
}
