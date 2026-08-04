export const DEEZER_TIMEOUT_MS = 5_000;
export const DEEZER_SEARCH_LIMIT_MAX = 50;
export const DEEZER_SEARCH_INDEX_MAX = 1_000;

export type DeezerErrorCode =
  | "DEEZER_TIMEOUT"
  | "DEEZER_CANCELLED"
  | "DEEZER_NETWORK"
  | "DEEZER_RATE_LIMITED"
  | "DEEZER_NOT_FOUND"
  | "DEEZER_CLIENT_ERROR"
  | "DEEZER_SERVER_ERROR"
  | "DEEZER_INVALID_JSON"
  | "DEEZER_INVALID_PAYLOAD"
  | "DEEZER_INVALID_INPUT";

export class DeezerError extends Error {
  constructor(
    readonly code: DeezerErrorCode,
    readonly operation: string,
    readonly status: number,
    readonly retryAfter?: string,
  ) {
    super(code);
    this.name = "DeezerError";
  }
}

export function deezerHttpError(error: DeezerError) {
  const headers = error.retryAfter ? { "Retry-After": error.retryAfter } : undefined;
  return { body: { error: error.code }, status: error.status, headers };
}

type DeezerRequestOptions = {
  operation: string;
  params?: Record<string, string | number | undefined>;
  signal?: AbortSignal;
  cache?: RequestCache;
  revalidate?: number;
  timeoutMs?: number;
};

function retryAfter(response: Response) {
  const value = response.headers.get("retry-after");
  return value && /^\d+$/.test(value) ? value : undefined;
}

function externalError(response: Response, operation: string): DeezerError {
  if (response.status === 404) return new DeezerError("DEEZER_NOT_FOUND", operation, 404);
  if (response.status === 429) return new DeezerError("DEEZER_RATE_LIMITED", operation, 503, retryAfter(response));
  if (response.status >= 500) return new DeezerError("DEEZER_SERVER_ERROR", operation, 502);
  return new DeezerError("DEEZER_CLIENT_ERROR", operation, 502);
}

export function requireDeezerId(value: string, operation: string): string {
  const normalized = value.trim();
  if (!/^\d{1,20}$/.test(normalized)) throw new DeezerError("DEEZER_INVALID_INPUT", operation, 400);
  return normalized;
}

export function requireDeezerQuery(value: string, operation: string): string {
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > 200) throw new DeezerError("DEEZER_INVALID_INPUT", operation, 400);
  return normalized;
}

export function requireDeezerPage(index: number, limit: number, operation: string) {
  if (!Number.isSafeInteger(index) || index < 0 || index > DEEZER_SEARCH_INDEX_MAX) {
    throw new DeezerError("DEEZER_INVALID_INPUT", operation, 400);
  }
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > DEEZER_SEARCH_LIMIT_MAX) {
    throw new DeezerError("DEEZER_INVALID_INPUT", operation, 400);
  }
  return { index, limit };
}

export function deezerObject(value: unknown, operation: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new DeezerError("DEEZER_INVALID_PAYLOAD", operation, 502);
  }
  return value as Record<string, unknown>;
}

export function deezerArray(value: unknown, operation: string): Record<string, unknown>[] {
  if (!Array.isArray(value) || value.some((item) => !item || typeof item !== "object" || Array.isArray(item))) {
    throw new DeezerError("DEEZER_INVALID_PAYLOAD", operation, 502);
  }
  return value as Record<string, unknown>[];
}

export async function getDeezerJson(path: string, options: DeezerRequestOptions): Promise<unknown> {
  const startedAt = performance.now();
  let timedOut = false;
  const controller = new AbortController();
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? DEEZER_TIMEOUT_MS);
  const signals = options.signal ? [options.signal, controller.signal] : [controller.signal];
  const signal = signals.length === 1 ? signals[0] : AbortSignal.any(signals);
  const url = new URL(path, "https://api.deezer.com");
  for (const [key, value] of Object.entries(options.params ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  try {
    const response = await fetch(url, {
      cache: options.cache ?? "no-store",
      signal,
      ...(options.revalidate === undefined ? {} : { next: { revalidate: options.revalidate } }),
    });
    if (!response.ok) throw externalError(response, options.operation);
    try {
      return await response.json();
    } catch {
      throw new DeezerError("DEEZER_INVALID_JSON", options.operation, 502);
    }
  } catch (error) {
    let normalized: DeezerError;
    if (error instanceof DeezerError) normalized = error;
    else if (timedOut) normalized = new DeezerError("DEEZER_TIMEOUT", options.operation, 504);
    else if (options.signal?.aborted) normalized = new DeezerError("DEEZER_CANCELLED", options.operation, 499);
    else normalized = new DeezerError("DEEZER_NETWORK", options.operation, 502);
    if (normalized.code !== "DEEZER_CANCELLED") {
      console.error("Deezer integration failure", {
        operation: normalized.operation,
        code: normalized.code,
        status: normalized.status,
        durationMs: Math.round(performance.now() - startedAt),
      });
    }
    throw normalized;
  } finally {
    clearTimeout(timer);
  }
}
