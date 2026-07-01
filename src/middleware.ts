import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "@/utils/auth";

export async function middleware(request: NextRequest) {
  const token = request.cookies.get("token")?.value;

  // Verify JWT
  const payload = token ? await verifyToken(token) : null;
  const { pathname } = request.nextUrl;

  // Protect write requests to reviews or ratings
  if (pathname.startsWith("/api/reviews") || pathname.startsWith("/api/ratings")) {
    if (request.method !== "GET") {
      if (!payload) {
        return NextResponse.json(
          { error: "Inicia sesión para realizar esta acción" },
          { status: 401 }
        );
      }
    }
  }

  // Inject user details in request headers for easy access in API routes
  const requestHeaders = new Headers(request.headers);
  
  // Prevent client header spoofing by deleting any pre-existing custom auth headers
  requestHeaders.delete("x-user-id");
  requestHeaders.delete("x-user-name");

  if (payload) {
    requestHeaders.set("x-user-id", payload.userId);
    requestHeaders.set("x-user-name", payload.username);
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

// Config matching rules for middleware execution
export const config = {
  matcher: [
    "/api/reviews/:path*",
    "/api/ratings/:path*",
  ],
};
