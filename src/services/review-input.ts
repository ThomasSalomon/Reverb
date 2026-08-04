import { parseMusicItemId, parseRatingValue, RatingError } from "./ratings";
import { normalizeReviewTagValues } from "@/utils/review-tags";
import {
  isJsonObject,
  rejectUnknownFields,
  RequestBodyError,
  type JsonObject,
} from "@/utils/request-body";

// The review UI had no maxLength. This is an explicit, conservative API limit
// for free-form reviews; it is kept separate from the 300-character comments.
export const MAX_REVIEW_CONTENT_LENGTH = 5_000;
export const MAX_FAVORITE_TRACK_LENGTH = 200;
export const MAX_REVIEW_TAGS = 5;
export const MAX_REVIEW_TAG_LENGTH = 20;

export type CreateReviewInput = {
  musicItemId: string;
  content: string;
  ratingValue: number;
  tags: string | null;
};

export type UpdateReviewInput = {
  content?: string;
  ratingValue?: number;
  tags?: string | null;
  favoriteTrack?: string | null;
};

function invalid(message: string): never {
  throw new RequestBodyError(message);
}

export function parseReviewContent(value: unknown): string {
  if (typeof value !== "string") invalid("content debe ser texto");
  const normalized = value.replace(/\r\n?/g, "\n");
  if (normalized.trim().length === 0) invalid("El contenido de la reseña no puede estar vacío");
  if (normalized.length > MAX_REVIEW_CONTENT_LENGTH) {
    invalid(`content no puede superar ${MAX_REVIEW_CONTENT_LENGTH} caracteres`);
  }
  return normalized.trim();
}

export function parseFavoriteTrack(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string") invalid("La canción favorita debe ser texto o null");
  const normalized = value.replace(/\r\n?/g, "\n").trim();
  if (normalized.length === 0) return null;
  if (normalized.length > MAX_FAVORITE_TRACK_LENGTH) {
    invalid(`La canción favorita no puede superar ${MAX_FAVORITE_TRACK_LENGTH} caracteres`);
  }
  return normalized;
}

export function parseReviewTags(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value) || value.length > MAX_REVIEW_TAGS) {
    invalid(`tags debe ser un array de hasta ${MAX_REVIEW_TAGS} textos`);
  }
  if (value.some((tag) => typeof tag !== "string" || tag.length > MAX_REVIEW_TAG_LENGTH)) {
    invalid(`Cada tag debe ser texto de hasta ${MAX_REVIEW_TAG_LENGTH} caracteres`);
  }
  return normalizeReviewTagValues(value, MAX_REVIEW_TAGS).join(",") || null;
}

function asBody(value: unknown, fields: readonly string[]): JsonObject {
  if (!isJsonObject(value)) invalid("El cuerpo debe ser un objeto JSON");
  rejectUnknownFields(value, fields);
  return value;
}

export function parseCreateReviewInput(value: unknown): CreateReviewInput {
  const body = asBody(value, ["musicItemId", "content", "ratingValue", "tags"]);
  if (!("musicItemId" in body) || !("content" in body) || !("ratingValue" in body)) {
    invalid("musicItemId, content y ratingValue son requeridos");
  }
  return {
    musicItemId: parseMusicItemId(body.musicItemId),
    content: parseReviewContent(body.content),
    ratingValue: parseRatingValue(body.ratingValue),
    tags: parseReviewTags(body.tags),
  };
}

export function parseUpdateReviewInput(value: unknown): UpdateReviewInput {
  const body = asBody(value, ["content", "ratingValue", "tags", "favoriteTrack"]);
  const update: UpdateReviewInput = {};
  if (Object.hasOwn(body, "content")) update.content = parseReviewContent(body.content);
  if (Object.hasOwn(body, "ratingValue")) update.ratingValue = parseRatingValue(body.ratingValue);
  if (Object.hasOwn(body, "tags")) update.tags = parseReviewTags(body.tags);
  if (Object.hasOwn(body, "favoriteTrack")) update.favoriteTrack = parseFavoriteTrack(body.favoriteTrack);
  if (Object.keys(update).length === 0) invalid("No se enviaron campos editables");
  return update;
}

export function isReviewInputError(error: unknown): error is RequestBodyError | RatingError {
  return error instanceof RequestBodyError || error instanceof RatingError;
}
