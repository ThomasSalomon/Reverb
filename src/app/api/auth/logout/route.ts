import { NextResponse } from "next/server";
import { clearAuthCookie, readAuthToken, revokeSessionForToken } from "@/utils/auth";

export async function POST(request: Request) {
  const token = readAuthToken(request);

  try {
    if (token) await revokeSessionForToken(token);
  } catch (error) {
    console.error("Logout session revocation error", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }

  const response = NextResponse.json({ message: "Sesión cerrada correctamente" });
  clearAuthCookie(response);
  return response;
}
