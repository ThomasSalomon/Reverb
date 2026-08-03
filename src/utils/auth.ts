import { errors, jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";

export type AuthUser = Readonly<{
  userId: string;
  username: string;
}>;

export type AuthFailureReason = "missing" | "invalid" | "expired";

export type AuthResult =
  | { ok: true; user: AuthUser }
  | { ok: false; reason: AuthFailureReason };

function readCookie(request: Request, name: string): string | undefined {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return undefined;

  for (const cookie of cookieHeader.split(";")) {
    const separator = cookie.indexOf("=");
    if (separator === -1) continue;

    const cookieName = cookie.slice(0, separator).trim();
    if (cookieName === name) {
      return cookie.slice(separator + 1).trim();
    }
  }

  return undefined;
}

function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("FATAL: JWT_SECRET environment variable is missing in production environment!");
    }
    return new TextEncoder().encode("development-fallback-secret-key-do-not-use-in-prod");
  }
  return new TextEncoder().encode(secret);
}

export async function signToken(payload: { userId: string; username: string }): Promise<string> {
  const secretKey = getSecretKey();
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d") // Token valid for 7 days
    .sign(secretKey);
}

async function authenticateToken(token: string): Promise<AuthResult> {
  try {
    const secretKey = getSecretKey();
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ["HS256"],
      requiredClaims: ["iat", "exp"],
    });

    if (
      typeof payload.userId !== "string" ||
      payload.userId.length === 0 ||
      typeof payload.username !== "string" ||
      payload.username.length === 0
    ) {
      return { ok: false, reason: "invalid" };
    }

    return {
      ok: true,
      user: {
        userId: payload.userId,
        username: payload.username,
      },
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof errors.JWTExpired ? "expired" : "invalid",
    };
  }
}

export async function verifyToken(token: string): Promise<AuthUser | null> {
  const result = await authenticateToken(token);
  return result.ok ? result.user : null;
}

export async function resolveAuthUser(request?: Request): Promise<AuthResult> {
  try {
    const token = request
      ? readCookie(request, "token")
      : cookies().get("token")?.value;

    if (!token) {
      return { ok: false, reason: "missing" };
    }

    return await authenticateToken(token);
  } catch {
    return { ok: false, reason: "invalid" };
  }
}

export async function getAuthUser(request?: Request): Promise<AuthUser | null> {
  const result = await resolveAuthUser(request);
  return result.ok ? result.user : null;
}
