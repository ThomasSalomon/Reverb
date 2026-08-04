export const COLLECTION_PAGE_DEFAULT = 20;
export const COLLECTION_PAGE_MAX = 50;

export class PaginationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaginationError";
  }
}

type TemporalCursor = { createdAt: string; id: string };
type DiaryCursor = { listenedAt: string; id: string };
type ListItemCursor = { order: number; id: string };

function decode(value: string): unknown {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    throw new PaginationError("El cursor no es válido");
  }
}

function date(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getPageLimit(searchParams: URLSearchParams): number {
  const raw = searchParams.get("limit");
  if (raw === null) return COLLECTION_PAGE_DEFAULT;
  if (!/^\d+$/.test(raw)) throw new PaginationError("El límite debe ser un entero positivo");
  const limit = Number(raw);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > COLLECTION_PAGE_MAX) {
    throw new PaginationError(`El límite debe estar entre 1 y ${COLLECTION_PAGE_MAX}`);
  }
  return limit;
}

export function temporalCursor(searchParams: URLSearchParams): TemporalCursor | null {
  const raw = searchParams.get("cursor");
  if (raw === null) return null;
  const cursor = decode(raw);
  if (!cursor || typeof cursor !== "object") throw new PaginationError("El cursor no es válido");
  const record = cursor as Record<string, unknown>;
  if (typeof record.id !== "string" || !date(record.createdAt)) throw new PaginationError("El cursor no es válido");
  return { id: record.id, createdAt: record.createdAt as string };
}

export function diaryCursor(searchParams: URLSearchParams): DiaryCursor | null {
  const raw = searchParams.get("cursor");
  if (raw === null) return null;
  const cursor = decode(raw);
  if (!cursor || typeof cursor !== "object") throw new PaginationError("El cursor no es válido");
  const record = cursor as Record<string, unknown>;
  if (typeof record.id !== "string" || !date(record.listenedAt)) throw new PaginationError("El cursor no es válido");
  return { id: record.id, listenedAt: record.listenedAt as string };
}

export function listItemCursor(searchParams: URLSearchParams): ListItemCursor | null {
  const raw = searchParams.get("cursor");
  if (raw === null) return null;
  const cursor = decode(raw);
  if (!cursor || typeof cursor !== "object") throw new PaginationError("El cursor no es válido");
  const record = cursor as Record<string, unknown>;
  if (typeof record.id !== "string" || !Number.isSafeInteger(record.order)) throw new PaginationError("El cursor no es válido");
  return { id: record.id, order: record.order as number };
}

export function descendingTemporalWhere(cursor: TemporalCursor | null): Array<Record<string, unknown>> | undefined {
  if (!cursor) return undefined;
  const createdAt = new Date(cursor.createdAt);
  return [
    { createdAt: { lt: createdAt } },
    { createdAt, id: { lt: cursor.id } },
  ];
}

export function ascendingTemporalWhere(cursor: TemporalCursor | null): Array<Record<string, unknown>> | undefined {
  if (!cursor) return undefined;
  const createdAt = new Date(cursor.createdAt);
  return [
    { createdAt: { gt: createdAt } },
    { createdAt, id: { gt: cursor.id } },
  ];
}

export function descendingDiaryWhere(cursor: DiaryCursor | null): Array<Record<string, unknown>> | undefined {
  if (!cursor) return undefined;
  const listenedAt = new Date(cursor.listenedAt);
  return [
    { listenedAt: { lt: listenedAt } },
    { listenedAt, id: { lt: cursor.id } },
  ];
}

export function ascendingListItemWhere(cursor: ListItemCursor | null): Array<Record<string, unknown>> | undefined {
  if (!cursor) return undefined;
  return [{ order: { gt: cursor.order } }, { order: cursor.order, id: { gt: cursor.id } }];
}

export function pageResult<T extends { id: string; createdAt?: Date; listenedAt?: Date }>(rows: T[], limit: number, field: "createdAt" | "listenedAt") {
  const hasNextPage = rows.length > limit;
  const items = hasNextPage ? rows.slice(0, limit) : rows;
  const last = items.at(-1);
  const nextCursor = hasNextPage && last
    ? Buffer.from(JSON.stringify({ id: last.id, [field]: last[field]?.toISOString() }), "utf8").toString("base64url")
    : null;
  return { items, nextCursor, hasNextPage, limit };
}

export function listItemPageResult<T extends { id: string; order: number }>(rows: T[], limit: number) {
  const hasNextPage = rows.length > limit;
  const items = hasNextPage ? rows.slice(0, limit) : rows;
  const last = items.at(-1);
  return {
    items,
    hasNextPage,
    limit,
    nextCursor: hasNextPage && last ? Buffer.from(JSON.stringify({ id: last.id, order: last.order }), "utf8").toString("base64url") : null,
  };
}
