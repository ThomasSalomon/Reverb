import * as jose from "jose";

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
  return new jose.SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d") // Token valid for 7 days
    .sign(secretKey);
}

export async function verifyToken(token: string) {
  try {
    const secretKey = getSecretKey();
    const { payload } = await jose.jwtVerify(token, secretKey);
    return payload as { userId: string; username: string };
  } catch (error) {
    return null;
  }
}
