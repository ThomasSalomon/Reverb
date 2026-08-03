import type { Prisma, PrismaClient } from "@prisma/client";
import { jwtVerify, SignJWT } from "jose";
import { prisma } from "@/services/db";
import { MAX_ITEMS_PER_LIST, MAX_LISTS_PER_USER } from "@/services/list-constraints";

export const MAX_PLAYLIST_IMPORT_BODY_BYTES = 256 * 1024;

const MAX_TITLE_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_TRACK_TEXT_LENGTH = 200;
const MAX_COVER_URL_LENGTH = 2048;
const DEFAULT_COVER_URL = "https://via.placeholder.com/500";
const DEEZER_TRACK_PREFIX = "deezer:track:";
const MAX_TRANSACTION_ATTEMPTS = 3;
const IMPORT_TICKET_ISSUER = "musicbox";
const IMPORT_TICKET_AUDIENCE = "playlist-import";

const TOP_LEVEL_KEYS = new Set(["title", "description", "tracks", "ticket"]);
const REQUESTED_TRACK_KEYS = new Set(["externalId", "type"]);
const TRUSTED_TRACK_KEYS = new Set(["externalId", "type", "title", "artist", "coverUrl"]);

export type PlaylistImportTrack = Readonly<{
  externalId: string;
  type: "SONG";
  title: string;
  artist: string;
  coverUrl: string | null;
}>;

export type PlaylistImportInput = Readonly<{
  title: string;
  description: string | null;
  tracks: readonly PlaylistImportTrack[];
}>;

type RequestedPlaylistTrack = Readonly<{
  externalId: string;
  type: "SONG";
}>;

type PlaylistImportStatus = 400 | 403 | 409 | 413;

export class PlaylistImportError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: PlaylistImportStatus,
  ) {
    super(message);
    this.name = "PlaylistImportError";
  }
}

function invalid(code: string, message: string): never {
  throw new PlaylistImportError(code, message, 400);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rejectUnknownKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  subject: string,
): void {
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    invalid("UNKNOWN_FIELD", `${subject} contiene campos no permitidos: ${unknown.join(", ")}`);
  }
}

function parseRequiredText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") {
    invalid("INVALID_FIELD", `${field} debe ser texto`);
  }

  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maxLength) {
    invalid("INVALID_FIELD", `${field} debe tener entre 1 y ${maxLength} caracteres`);
  }

  return normalized;
}

function parseDescription(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    invalid("INVALID_FIELD", "description debe ser texto o null");
  }

  const normalized = value.trim();
  if (normalized.length > MAX_DESCRIPTION_LENGTH) {
    invalid(
      "INVALID_FIELD",
      `description no puede superar ${MAX_DESCRIPTION_LENGTH} caracteres`,
    );
  }

  return normalized.length === 0 ? null : normalized;
}

function parseCoverUrl(value: unknown, index: number): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_COVER_URL_LENGTH) {
    invalid("INVALID_TRACK", `tracks[${index}].coverUrl debe ser una URL HTTPS o null`);
  }

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) throw new Error();
    return url.toString();
  } catch {
    invalid(
      "INVALID_TRACK",
      `tracks[${index}].coverUrl debe ser una URL HTTPS sin credenciales`,
    );
  }
}

function parseTrackIdentity(value: unknown, index: number): RequestedPlaylistTrack {
  if (!isRecord(value)) {
    invalid("INVALID_TRACK", `tracks[${index}] debe ser un objeto`);
  }
  rejectUnknownKeys(value, REQUESTED_TRACK_KEYS, `tracks[${index}]`);

  if (
    typeof value.externalId !== "string" ||
    !/^[1-9]\d{0,19}$/.test(value.externalId)
  ) {
    invalid(
      "INVALID_TRACK",
      `tracks[${index}].externalId debe ser un identificador decimal positivo de hasta 20 digitos`,
    );
  }
  if (value.type !== "SONG") {
    invalid("INVALID_TRACK", `tracks[${index}].type debe ser SONG`);
  }

  return {
    externalId: value.externalId,
    type: "SONG",
  };
}

function parseTrustedTrack(value: unknown, index: number): PlaylistImportTrack {
  if (!isRecord(value)) {
    invalid("INVALID_IMPORT_TICKET", `ticket.tracks[${index}] debe ser un objeto`);
  }
  rejectUnknownKeys(value, TRUSTED_TRACK_KEYS, `ticket.tracks[${index}]`);
  const identity = parseTrackIdentity(
    { externalId: value.externalId, type: value.type },
    index,
  );

  return {
    ...identity,
    title: parseRequiredText(value.title, `tracks[${index}].title`, MAX_TRACK_TEXT_LENGTH),
    artist: parseRequiredText(value.artist, `tracks[${index}].artist`, MAX_TRACK_TEXT_LENGTH),
    coverUrl: parseCoverUrl(value.coverUrl, index),
  };
}

function getImportTicketKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("FATAL: JWT_SECRET is required to sign playlist import tickets");
    }
    return new TextEncoder().encode("development-fallback-secret-key-do-not-use-in-prod");
  }
  return new TextEncoder().encode(secret);
}

export async function createPlaylistImportTicket(
  tracks: readonly PlaylistImportTrack[],
): Promise<string> {
  if (tracks.length === 0 || tracks.length > MAX_ITEMS_PER_LIST) {
    throw new Error(`Playlist import tickets require 1-${MAX_ITEMS_PER_LIST} tracks`);
  }
  const trustedTracks: PlaylistImportTrack[] = [];
  const seen = new Set<string>();
  tracks.forEach((track, index) => {
    const parsed = parseTrustedTrack(track, index);
    const identity = `${parsed.type}:${parsed.externalId}`;
    if (seen.has(identity)) return;
    seen.add(identity);
    trustedTracks.push(parsed);
  });

  return new SignJWT({ tracks: trustedTracks })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(IMPORT_TICKET_ISSUER)
    .setAudience(IMPORT_TICKET_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(getImportTicketKey());
}

async function verifyPlaylistImportTicket(ticket: string): Promise<PlaylistImportTrack[]> {
  try {
    const { payload } = await jwtVerify(ticket, getImportTicketKey(), {
      algorithms: ["HS256"],
      issuer: IMPORT_TICKET_ISSUER,
      audience: IMPORT_TICKET_AUDIENCE,
      requiredClaims: ["iat", "exp"],
    });
    if (!Array.isArray(payload.tracks) || payload.tracks.length === 0 || payload.tracks.length > MAX_ITEMS_PER_LIST) {
      invalid("INVALID_IMPORT_TICKET", "El ticket de importacion no contiene pistas validas");
    }
    return payload.tracks.map((track, index) => parseTrustedTrack(track, index));
  } catch (error) {
    if (error instanceof PlaylistImportError) throw error;
    invalid("INVALID_IMPORT_TICKET", "El ticket de importacion es invalido o expiro");
  }
}

export async function parsePlaylistImportInput(value: unknown): Promise<PlaylistImportInput> {
  if (!isRecord(value)) invalid("INVALID_BODY", "El body debe ser un objeto JSON");
  rejectUnknownKeys(value, TOP_LEVEL_KEYS, "El body");

  const title = parseRequiredText(value.title, "title", MAX_TITLE_LENGTH);
  const description = parseDescription(value.description);
  if (!Array.isArray(value.tracks)) {
    invalid("INVALID_TRACKS", "tracks debe ser un array");
  }
  if (value.tracks.length === 0) {
    invalid("EMPTY_PLAYLIST", "La playlist debe contener al menos una pista");
  }
  if (value.tracks.length > MAX_ITEMS_PER_LIST) {
    throw new PlaylistImportError(
      "TRACK_LIMIT_EXCEEDED",
      `La playlist no puede superar ${MAX_ITEMS_PER_LIST} pistas`,
      413,
    );
  }

  if (typeof value.ticket !== "string" || value.ticket.length === 0 || value.ticket.length > MAX_PLAYLIST_IMPORT_BODY_BYTES) {
    invalid("INVALID_IMPORT_TICKET", "ticket es requerido");
  }

  const requestedTracks: RequestedPlaylistTrack[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < value.tracks.length; index += 1) {
    const track = parseTrackIdentity(value.tracks[index], index);
    const identity = `${track.type}:${track.externalId}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    requestedTracks.push(track);
  }

  const trustedTracks = await verifyPlaylistImportTicket(value.ticket);
  const trustedByIdentity = new Map(
    trustedTracks.map((track) => [`${track.type}:${track.externalId}`, track]),
  );
  const tracks = requestedTracks.map((track) => {
    const trusted = trustedByIdentity.get(`${track.type}:${track.externalId}`);
    if (!trusted) {
      invalid(
        "TRACK_NOT_AUTHORIZED",
        `La pista ${track.externalId} no pertenece a la seleccion autorizada`,
      );
    }
    return trusted;
  });

  return { title, description, tracks };
}

export async function readPlaylistImportJson(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    invalid("INVALID_CONTENT_TYPE", "Content-Type debe ser application/json");
  }

  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    const length = Number(declaredLength);
    if (Number.isFinite(length) && length > MAX_PLAYLIST_IMPORT_BODY_BYTES) {
      throw new PlaylistImportError(
        "BODY_TOO_LARGE",
        `El body no puede superar ${MAX_PLAYLIST_IMPORT_BODY_BYTES} bytes`,
        413,
      );
    }
  }

  if (!request.body) invalid("INVALID_JSON", "El body JSON es requerido");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_PLAYLIST_IMPORT_BODY_BYTES) {
        await reader.cancel();
        throw new PlaylistImportError(
          "BODY_TOO_LARGE",
          `El body no puede superar ${MAX_PLAYLIST_IMPORT_BODY_BYTES} bytes`,
          413,
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return JSON.parse(text) as unknown;
  } catch {
    invalid("INVALID_JSON", "El body debe contener JSON valido en UTF-8");
  }
}

const musicItemSelect = {
  id: true,
  title: true,
  artist: true,
  type: true,
  coverUrl: true,
  releaseYear: true,
} satisfies Prisma.MusicItemSelect;

type ResolvedMusicItem = Prisma.MusicItemGetPayload<{ select: typeof musicItemSelect }>;

function namespacedTrackId(externalId: string): string {
  return `${DEEZER_TRACK_PREFIX}${externalId}`;
}

function isRetryableTransactionError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = "code" in error ? String(error.code) : "";
  const message = "message" in error ? String(error.message) : "";
  return (
    code === "P2002" ||
    code === "P2034" ||
    message.includes("SQLITE_BUSY") ||
    message.includes("database is locked")
  );
}

async function delay(milliseconds: number): Promise<void> {
  await new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

async function importInTransaction(
  client: PrismaClient,
  userId: string,
  input: PlaylistImportInput,
  releaseYear: number,
) {
  return client.$transaction(
    async (tx) => {
      const listsCount = await tx.list.count({ where: { userId } });
      if (listsCount >= MAX_LISTS_PER_USER) {
        throw new PlaylistImportError(
          "LIST_LIMIT_EXCEEDED",
          `Has alcanzado el limite maximo de ${MAX_LISTS_PER_USER} listas`,
          403,
        );
      }

      const candidateIds = input.tracks.flatMap((track) => [
        namespacedTrackId(track.externalId),
        track.externalId,
      ]);
      const existingItems = await tx.musicItem.findMany({
        where: { id: { in: candidateIds } },
        select: musicItemSelect,
      });
      const existingById = new Map(existingItems.map((item) => [item.id, item]));
      const resolvedItems: ResolvedMusicItem[] = [];
      const itemsToCreate: Prisma.MusicItemCreateManyInput[] = [];

      for (const track of input.tracks) {
        const namespacedId = namespacedTrackId(track.externalId);
        const namespaced = existingById.get(namespacedId);
        if (namespaced && namespaced.type !== "SONG") {
          throw new PlaylistImportError(
            "MUSIC_ITEM_IDENTITY_CONFLICT",
            `El identificador ${track.externalId} ya pertenece a otro tipo de elemento`,
            409,
          );
        }

        const legacy = existingById.get(track.externalId);
        const resolved = namespaced ?? (legacy?.type === "SONG" ? legacy : undefined);
        if (resolved) {
          resolvedItems.push(resolved);
          continue;
        }

        const created: ResolvedMusicItem = {
          id: namespacedId,
          title: track.title,
          artist: track.artist,
          type: "SONG",
          coverUrl: track.coverUrl ?? DEFAULT_COVER_URL,
          releaseYear,
        };
        resolvedItems.push(created);
        itemsToCreate.push(created);
      }

      if (itemsToCreate.length > 0) {
        await tx.musicItem.createMany({ data: itemsToCreate });
      }

      const list = await tx.list.create({
        data: {
          title: input.title,
          description: input.description,
          isPublic: true,
          userId,
        },
      });
      const itemById = new Map(resolvedItems.map((item) => [item.id, item]));
      const relations = await tx.listItem.createManyAndReturn({
        data: resolvedItems.map((item, order) => ({
          listId: list.id,
          musicItemId: item.id,
          order,
        })),
        select: {
          id: true,
          order: true,
          createdAt: true,
          musicItemId: true,
        },
      });

      return {
        ...list,
        items: relations
          .sort((left, right) => left.order - right.order)
          .map((relation) => ({
            ...relation,
            musicItem: itemById.get(relation.musicItemId)!,
          })),
      };
    },
    { maxWait: 5_000, timeout: 5_000 },
  );
}

export async function importPlaylist(
  userId: string,
  input: PlaylistImportInput,
  client: PrismaClient = prisma,
) {
  const releaseYear = new Date().getUTCFullYear();
  for (let attempt = 0; attempt < MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await importInTransaction(client, userId, input, releaseYear);
    } catch (error) {
      if (
        error instanceof PlaylistImportError ||
        !isRetryableTransactionError(error) ||
        attempt === MAX_TRANSACTION_ATTEMPTS - 1
      ) {
        throw error;
      }
      await delay(5 * (attempt + 1));
    }
  }

  throw new Error("Unreachable playlist import retry state");
}
