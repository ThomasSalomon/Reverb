import type { Prisma } from "@prisma/client";
import { prisma } from "@/services/db";
import { AppError } from "@/utils/errors";

const MIN_RATING = 0.5;
const MAX_RATING = 5;
const RATING_STEP_MULTIPLIER = 2;

const currentRatingSelect = {
  id: true,
  value: true,
  createdAt: true,
  updatedAt: true,
  userId: true,
  musicItemId: true,
} satisfies Prisma.RatingSelect;

type RatingPersistenceClient = Pick<Prisma.TransactionClient, "musicItem" | "rating">;

export class RatingError extends AppError {
  constructor(
    message: string,
    status: 400 | 404,
  ) {
    super(message, status, status === 404 ? "MUSIC_ITEM_NOT_FOUND" : "INVALID_RATING");
  }
}

export function parseRatingValue(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < MIN_RATING ||
    value > MAX_RATING ||
    !Number.isInteger(value * RATING_STEP_MULTIPLIER)
  ) {
    throw new RatingError(
      "La calificación debe ser numérica, de 0.5 a 5 y en incrementos de 0.5",
      400,
    );
  }

  return value;
}

export function parseMusicItemId(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > 200) {
    throw new RatingError("musicItemId es requerido", 400);
  }

  return value.trim();
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

export const RatingService = {
  async setCurrent(
    input: { userId: string; musicItemId: string; value: number },
    client: RatingPersistenceClient = prisma,
  ) {
    const musicItemId = parseMusicItemId(input.musicItemId);
    const value = parseRatingValue(input.value);
    const item = await client.musicItem.findUnique({
      where: { id: musicItemId },
      select: { id: true },
    });

    if (!item) {
      throw new RatingError("Ítem musical no encontrado", 404);
    }

    const where = {
      userId_musicItemId: {
        userId: input.userId,
        musicItemId,
      },
    };

    try {
      return await client.rating.upsert({
        where,
        update: { value },
        create: { userId: input.userId, musicItemId, value },
        select: currentRatingSelect,
      });
    } catch (error) {
      // Native upsert is expected to handle the race. Some adapters may still
      // surface the unique conflict, so recover once and propagate every other
      // error unchanged.
      if (!isUniqueConstraintError(error)) throw error;

      return client.rating.update({
        where,
        data: { value },
        select: currentRatingSelect,
      });
    }
  },
};
