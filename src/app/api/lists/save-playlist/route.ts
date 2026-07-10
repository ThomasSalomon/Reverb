import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/services/db";
import { verifyToken } from "@/utils/auth";
import type { DeezerTrack } from "@/services/deezer.service";

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

    const { title, description, tracks } = await req.json();

    if (!title || !Array.isArray(tracks) || tracks.length === 0) {
      return NextResponse.json(
        { error: "Título y pistas son requeridos" },
        { status: 400 }
      );
    }

    const listsCount = await prisma.list.count({
      where: { userId: authUser.userId },
    });

    if (listsCount >= 50) {
      return NextResponse.json(
        { error: "Has alcanzado el límite máximo de 50 listas." },
        { status: 403 }
      );
    }

    // Create list first
    const newList = await prisma.list.create({
      data: {
        title: title.substring(0, 100),
        description: description?.substring(0, 500),
        isPublic: true,
        userId: authUser.userId,
      },
    });

    // Upsert all tracks and add them to the list
    const itemsData = [];
    for (let i = 0; i < tracks.length; i++) {
      const track: DeezerTrack = tracks[i];
      const musicItemId = track.id.toString();

      // Ensure MusicItem exists
      await prisma.musicItem.upsert({
        where: { id: musicItemId },
        create: {
          id: musicItemId,
          title: track.title,
          artist: track.artist.name,
          type: "SONG",
          coverUrl: track.album.cover_xl || "https://via.placeholder.com/500",
          releaseYear: new Date().getFullYear(), // Fallback
        },
        update: {},
      });

      itemsData.push({
        listId: newList.id,
        musicItemId: musicItemId,
        order: i,
      });
    }

    // Insert list items
    await prisma.listItem.createMany({
      data: itemsData,
    });

    return NextResponse.json(newList, { status: 201 });
  } catch (error) {
    console.error("POST save-playlist error:", error);
    return NextResponse.json(
      { error: "Error al guardar la lista" },
      { status: 500 }
    );
  }
}
