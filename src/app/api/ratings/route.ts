import { NextResponse } from "next/server";
import {
  parseMusicItemId,
  parseRatingValue,
  RatingError,
  RatingService,
} from "@/services/ratings";
import { resolveAuthUser } from "@/utils/auth";

export async function POST(req: Request) {
  try {
    const auth = await resolveAuthUser(req);
    if (!auth.ok) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }
    const { userId } = auth.user;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "El cuerpo debe contener JSON válido" },
        { status: 400 },
      );
    }

    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      throw new RatingError("El cuerpo debe ser un objeto JSON", 400);
    }

    const input = body as Record<string, unknown>;
    const musicItemId = parseMusicItemId(input.musicItemId);
    const numericValue = parseRatingValue(input.value);
    const rating = await RatingService.setCurrent({
      userId,
      musicItemId,
      value: numericValue,
    });

    return NextResponse.json({
      message: "Calificación guardada con éxito",
      rating,
    });
  } catch (error) {
    if (error instanceof RatingError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Save rating error:", error);
    return NextResponse.json(
      { error: "Error interno al guardar la calificación" },
      { status: 500 }
    );
  }
}
