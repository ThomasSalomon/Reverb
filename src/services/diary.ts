import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { MusicService } from "./music";

const ALLOWED_MUSIC_TYPES = new Set(["ALBUM", "SONG"]);
const MAX_MUSIC_ITEM_ID_LENGTH = 200;
export const MAX_DIARY_NOTES_LENGTH = 500;

const diaryEventSelect = {
  id: true,
  listenedAt: true,
  ratingValue: true,
  notes: true,
  createdAt: true,
  musicItemId: true,
  listenCount: true,
  musicItem: {
    select: {
      id: true,
      title: true,
      artist: true,
      coverUrl: true,
      type: true,
    },
  },
} satisfies Prisma.DiaryLogSelect;

export class DiaryError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404,
  ) {
    super(message);
    this.name = "DiaryError";
  }
}

export type CreateDiaryEventInput = {
  musicItemId: string;
  listenedAt?: Date;
  ratingValue: number | null;
  notes: string | null;
};

export type UpdateDiaryEventInput = {
  listenedAt?: Date;
  ratingValue?: number | null;
  notes?: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseMusicItemId(value: unknown): string {
  if (typeof value !== "string") {
    throw new DiaryError("musicItemId debe ser un string", 400);
  }
  const musicItemId = value.trim();
  if (musicItemId.length === 0 || musicItemId.length > MAX_MUSIC_ITEM_ID_LENGTH) {
    throw new DiaryError("musicItemId es inválido", 400);
  }
  return musicItemId;
}

function parseListenedAt(value: unknown): Date {
  if (typeof value !== "string") {
    throw new DiaryError("listenedAt debe ser una fecha válida", 400);
  }
  const normalized = value.trim();
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(normalized);
  const dateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(normalized);
  if (!dateOnly && !dateTime) {
    throw new DiaryError("listenedAt debe ser una fecha ISO válida", 400);
  }

  const [year, month, day] = normalized.slice(0, 10).split("-").map(Number);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  if (
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() !== month - 1 ||
    calendarDate.getUTCDate() !== day
  ) {
    throw new DiaryError("listenedAt debe ser una fecha válida", 400);
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new DiaryError("listenedAt debe ser una fecha válida", 400);
  }
  return parsed;
}

function parseRating(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;

  const parsed = typeof value === "number"
    ? value
    : typeof value === "string"
      ? Number(value)
      : Number.NaN;

  if (
    !Number.isFinite(parsed) ||
    parsed < 0.5 ||
    parsed > 5 ||
    Math.abs(parsed * 2 - Math.round(parsed * 2)) > Number.EPSILON
  ) {
    throw new DiaryError("ratingValue debe estar entre 0.5 y 5 en pasos de 0.5", 400);
  }
  return parsed;
}

function parseNotes(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    throw new DiaryError("notes debe ser un string", 400);
  }
  if (value.length > MAX_DIARY_NOTES_LENGTH) {
    throw new DiaryError(
      `notes no puede superar ${MAX_DIARY_NOTES_LENGTH} caracteres`,
      400,
    );
  }
  return value.trim() || null;
}

export function parseCreateDiaryEvent(value: unknown): CreateDiaryEventInput {
  if (!isRecord(value)) throw new DiaryError("El payload debe ser un objeto JSON", 400);

  return {
    musicItemId: parseMusicItemId(value.musicItemId),
    listenedAt: value.listenedAt === undefined
      ? undefined
      : parseListenedAt(value.listenedAt),
    ratingValue: parseRating(value.ratingValue),
    notes: parseNotes(value.notes),
  };
}

export function parseUpdateDiaryEvent(value: unknown): UpdateDiaryEventInput {
  if (!isRecord(value)) throw new DiaryError("El payload debe ser un objeto JSON", 400);

  const update: UpdateDiaryEventInput = {};
  if (Object.hasOwn(value, "listenedAt")) update.listenedAt = parseListenedAt(value.listenedAt);
  if (Object.hasOwn(value, "ratingValue")) update.ratingValue = parseRating(value.ratingValue);
  if (Object.hasOwn(value, "notes")) update.notes = parseNotes(value.notes);

  if (Object.keys(update).length === 0) {
    throw new DiaryError("No se enviaron campos editables", 400);
  }
  return update;
}

export const DiaryService = {
  async createEvent(userId: string, input: CreateDiaryEventInput) {
    const musicItem = await MusicService.getItemById(input.musicItemId);
    if (!musicItem) throw new DiaryError("Elemento musical no encontrado", 404);
    if (!ALLOWED_MUSIC_TYPES.has(musicItem.type)) {
      throw new DiaryError("Tipo de elemento musical no permitido", 400);
    }

    return prisma.diaryLog.create({
      data: {
        userId,
        musicItemId: input.musicItemId,
        listenedAt: input.listenedAt ?? new Date(),
        ratingValue: input.ratingValue,
        notes: input.notes,
        // Compatibilidad legacy: los eventos nuevos siempre representan una escucha.
        listenCount: 1,
      },
      select: diaryEventSelect,
    });
  },

  async listEvents(userId: string) {
    return prisma.diaryLog.findMany({
      where: { userId },
      orderBy: [
        { listenedAt: "desc" },
        { createdAt: "desc" },
        { id: "desc" },
      ],
      select: diaryEventSelect,
    });
  },

  async updateEvent(id: string, userId: string, input: UpdateDiaryEventInput) {
    const result = await prisma.diaryLog.updateMany({
      where: { id, userId },
      data: input,
    });
    if (result.count === 0) return null;

    return prisma.diaryLog.findUnique({
      where: { id },
      select: diaryEventSelect,
    });
  },

  async deleteEvent(id: string, userId: string): Promise<boolean> {
    const result = await prisma.diaryLog.deleteMany({ where: { id, userId } });
    return result.count === 1;
  },

  async getStats(userId: string) {
    const [aggregate, uniqueItems, latestListen] = await Promise.all([
      prisma.diaryLog.aggregate({
        where: { userId },
        _count: { _all: true },
        _sum: { listenCount: true },
      }),
      prisma.diaryLog.groupBy({
        by: ["musicItemId"],
        where: { userId },
      }),
      prisma.diaryLog.findFirst({
        where: { userId },
        orderBy: [
          { listenedAt: "desc" },
          { createdAt: "desc" },
          { id: "desc" },
        ],
        select: {
          id: true,
          listenedAt: true,
          musicItem: {
            select: { id: true, title: true, artist: true },
          },
        },
      }),
    ]);

    return {
      diaryEntries: aggregate._count._all,
      totalListens: aggregate._sum.listenCount ?? 0,
      uniqueListenedItems: uniqueItems.length,
      latestListen,
    };
  },
};
