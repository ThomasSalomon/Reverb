import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApiRoute = pathname.startsWith("/api");

  if (!isApiRoute && !request.cookies.has("NEXT_LOCALE")) {
    const country = request.geo?.country || request.headers.get("x-vercel-ip-country");
    if (country === "BR") request.headers.set("accept-language", "pt");
    else if (country) {
      const spanishCountries = ["AR", "BO", "CL", "CO", "CR", "CU", "DO", "EC", "SV", "GQ", "GT", "HN", "MX", "NI", "PA", "PY", "PE", "PR", "ES", "UY", "VE"];
      request.headers.set("accept-language", spanishCountries.includes(country) ? "es" : "en");
    }
  }

  // Persistent-session validation happens in each route handler through the
  // authoritative auth helper. Keeping middleware free of database access avoids
  // an Edge-incompatible duplicate query and never makes it an identity source.
  return isApiRoute ? NextResponse.next() : intlMiddleware(request);
}

export const config = {
  matcher: [
    '/((?!api|_next|_vercel|.*\\..*).*)',
    "/api/reviews/:path*",
    "/api/ratings/:path*",
    "/api/diary/:path*",
    "/api/lists/:path*",
    "/api/listen-later/:path*",
    "/api/comments/:path*",
    "/api/users/:path*",
  ],
};
