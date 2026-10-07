import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PAGES = ["/login", "/invite/"];

function hasSession(request: NextRequest) {
  return request.cookies.getAll().some((c) => c.name.endsWith("better-auth.session_token"));
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api/") || PUBLIC_PAGES.some((p) => pathname === p || pathname.startsWith(p))) return NextResponse.next();
  if (hasSession(request)) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|robots.txt).*)"],
};
