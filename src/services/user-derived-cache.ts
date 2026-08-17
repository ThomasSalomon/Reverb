import { revalidateTag } from "next/cache";

/**
 * Server-data cache policy for aggregates derived from a user's music activity.
 * Tags use internal IDs, which are stable for the mutation paths that invalidate
 * them and do not expose user-facing identifiers in cache tooling.
 */
const CACHE_NAMESPACE = "rtm:user-derived";

export const USER_DERIVED_CACHE_TTL_SECONDS = 3_600;

export function userStatsCacheTag(userId: string): string {
  return `${CACHE_NAMESPACE}:stats:${userId}`;
}

export function userRecapCacheTag(userId: string, year: number): string {
  return `${CACHE_NAMESPACE}:recap:${userId}:${year}`;
}

function requestTagRevalidation(tag: string): void {
  try {
    revalidateTag(tag);
  } catch (error) {
    // Direct route-handler tests do not execute inside Next's static-generation
    // context. Production Route Handlers do, so this branch is not a substitute
    // for invalidation in the application runtime.
    if (
      error instanceof Error &&
      error.message.startsWith("Invariant: static generation store missing")
    ) {
      return;
    }

    // The write has already committed. Do not report it as a failed mutation or
    // attempt a fictitious rollback; preserve the TTL as a bounded fallback.
    console.error("User-derived cache invalidation failed", { tag, error });
  }
}

export function invalidateUserStatsCache(userId: string): void {
  requestTagRevalidation(userStatsCacheTag(userId));
}

export function invalidateUserRecapCache(userId: string, year: number): void {
  requestTagRevalidation(userRecapCacheTag(userId, year));
}
