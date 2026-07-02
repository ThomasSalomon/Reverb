export type RateLimitOptions = {
  windowMs: number;
  max: number;
};

// Global cache for rate limiting. 
// Note: In a distributed production environment (e.g. Vercel), this only limits per-instance. 
// A more robust solution would use Redis (e.g. Upstash).
const rateLimitCache = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(
  ip: string,
  options: RateLimitOptions
): { success: boolean; limit: number; remaining: number; reset: number } {
  const now = Date.now();
  
  if (!rateLimitCache.has(ip)) {
    const resetTime = now + options.windowMs;
    rateLimitCache.set(ip, { count: 1, resetTime });
    return { success: true, limit: options.max, remaining: options.max - 1, reset: resetTime };
  }

  const record = rateLimitCache.get(ip)!;

  if (now > record.resetTime) {
    record.count = 1;
    record.resetTime = now + options.windowMs;
    return { success: true, limit: options.max, remaining: options.max - 1, reset: record.resetTime };
  }

  record.count += 1;

  if (record.count > options.max) {
    return { success: false, limit: options.max, remaining: 0, reset: record.resetTime };
  }

  return { success: true, limit: options.max, remaining: options.max - record.count, reset: record.resetTime };
}

export function getIP(req: Request): string {
  // In Next.js App Router, req is a standard web Request
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  return 'unknown-ip';
}
