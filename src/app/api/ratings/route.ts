import { NextResponse } from "next/server";
import {
  parseMusicItemId,
  parseRatingValue,
  RatingError,
  RatingService,
} from "@/services/ratings";
import { resolveAuthUser } from "@/utils/auth";
import { rejectUnknownFields, RequestBodyError, readJsonObject } from "@/utils/request-body";

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

    const input = await readJsonObject(req);
    rejectUnknownFields(input, ["musicItemId", "value"]);
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
    if (error instanceof RatingError || error instanceof RequestBodyError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Save rating error:", error);
    return NextResponse.json(
      { error: "Error interno al guardar la calificación" },
      { status: 500 }
    );
  }
}
