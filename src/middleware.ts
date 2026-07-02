import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "@/utils/auth";

export async function middleware(request: NextRequest) {
  const token = request.cookies.get("token")?.value;

  // Verify JWT
  const payload = token ? await verifyToken(token) : null;
  const { pathname } = request.nextUrl;

  const protectedWriteRoutes = [
    "/api/reviews",
    "/api/ratings",
    "/api/diary",
    "/api/lists",
    "/api/listen-later",
    "/api/comments",
    "/api/users" // /api/users requires auth for PUT/PATCH/DELETE
  ];

  const isProtectedWrite = protectedWriteRoutes.some(route => pathname.startsWith(route));

  // Protect write requests
  if (isProtectedWrite && request.method !== "GET") {
    if (!payload) {
      return NextResponse.json(
        { error: "Inicia sesión para realizar esta acción" },
        { status: 401 }
      );
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
    "/api/diary/:path*",
    "/api/lists/:path*",
    "/api/listen-later/:path*",
    "/api/comments/:path*",
    "/api/users/:path*",
  ],
};
