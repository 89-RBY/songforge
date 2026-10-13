import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE, localeFromPath, negotiateLocale } from "@/i18n/routing";

// Every page lives under /<locale>. A request without a locale is sent to the best one for this visitor.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const current = localeFromPath(pathname);

  if (current) {
    const response = NextResponse.next();
    if (request.cookies.get(LOCALE_COOKIE)?.value !== current) {
      response.cookies.set(LOCALE_COOKIE, current, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    }
    return response;
  }

  const locale = negotiateLocale(request.cookies.get(LOCALE_COOKIE)?.value, request.headers.get("accept-language"));
  const url = request.nextUrl.clone();
  url.pathname = pathname === "/" ? `/${locale}` : `/${locale}${pathname}`;
  return NextResponse.redirect(url, 307);
}

export const config = {
  // Skips API routes, Next internals and any path with a file extension (images, favicon, audio).
  matcher: ["/((?!api/|_next/|.*\\.).*)"],
};
