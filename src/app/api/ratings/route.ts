import { NextResponse } from "next/server";
import { prisma } from "@/services/db";

export async function POST(req: Request) {
  try {
    const userId = req.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    const { musicItemId, value } = await req.json();

    if (!musicItemId || value === undefined) {
      return NextResponse.json(
        { error: "musicItemId y value son requeridos" },
        { status: 400 }
      );
    }

    const numericValue = parseFloat(value);
    if (isNaN(numericValue) || numericValue < 1 || numericValue > 5 || numericValue % 0.5 !== 0) {
      return NextResponse.json(
        { error: "La calificación debe ser de 1 a 5 con incrementos de 0.5" },
        { status: 400 }
      );
    }

    // Verify music item exists
    const musicItem = await prisma.musicItem.findUnique({
      where: { id: musicItemId },
    });

    if (!musicItem) {
      return NextResponse.json(
        { error: "Ítem musical no encontrado" },
        { status: 404 }
      );
    }

    // Upsert rating
    const rating = await prisma.rating.upsert({
      where: {
        userId_musicItemId: {
          userId,
          musicItemId,
        },
      },
      update: {
        value: numericValue,
      },
      create: {
        userId,
        musicItemId,
        value: numericValue,
      },
    });

    return NextResponse.json({
      message: "Calificación guardada con éxito",
      rating,
    });
  } catch (error) {
    console.error("Save rating error:", error);
    return NextResponse.json(
      { error: "Error interno al guardar la calificación" },
      { status: 500 }
    );
  }
}
