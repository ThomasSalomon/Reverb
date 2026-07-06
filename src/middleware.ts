import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "@/utils/auth";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // 1. Define if the route is an API route (ignore i18n routing here)
  const isApiRoute = pathname.startsWith("/api");
  
  // 2. Apply next-intl middleware for non-API routes
  let response = isApiRoute ? NextResponse.next() : intlMiddleware(request);

  // 3. Auth Logic Validation
  const token = request.cookies.get("token")?.value;
  const payload = token ? await verifyToken(token) : null;

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

  // Protect write requests to the API
  if (isProtectedWrite && request.method !== "GET") {
    if (!payload) {
      return NextResponse.json(
        { error: "Inicia sesión para realizar esta acción" },
        { status: 401 }
      );
    }
  }

  // 4. Inject user details in request headers for API routes
  if (isApiRoute) {
    const requestHeaders = new Headers(request.headers);
    // Prevent client header spoofing
    requestHeaders.delete("x-user-id");
    requestHeaders.delete("x-user-name");

    if (payload) {
      requestHeaders.set("x-user-id", payload.userId);
      requestHeaders.set("x-user-name", payload.username);
    }

    // Re-create the next response with headers attached to the request
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  return response;
}

// Config matching rules for middleware execution
export const config = {
  matcher: [
    // Enable i18n routing for all paths except api, _next, public files
    '/((?!api|_next|_vercel|.*\\..*).*)',
    // Apply auth middleware to specific API routes
    "/api/reviews/:path*",
    "/api/ratings/:path*",
    "/api/diary/:path*",
    "/api/lists/:path*",
    "/api/listen-later/:path*",
    "/api/comments/:path*",
    "/api/users/:path*",
  ],
};
