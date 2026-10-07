import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_EXACT = new Set(["/api/integrations/revenuecat", "/api/integrations/superwall"]);
const PUBLIC_PREFIXES = ["/api/attribution/"];

function isPublic(pathname: string, authorization: string | null) {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (path === "/api/mcp" && authorization?.startsWith("Bearer ")) return true;
  return PUBLIC_EXACT.has(path) || PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix));
}

async function digest(value: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function constantTimeEqual(a: string, b: string) {
  const [ha, hb] = await Promise.all([digest(a), digest(b)]);
  let diff = a.length === b.length ? 0 : 1;
  for (let i = 0; i < ha.length; i++) diff |= ha[i] ^ hb[i];
  return diff === 0;
}

function decodeBasic(header: string | null) {
  if (!header?.startsWith("Basic ")) return null;
  try {
    const decoded = atob(header.slice(6).trim());
    const index = decoded.indexOf(":");
    return index < 0 ? null : { user: decoded.slice(0, index), password: decoded.slice(index + 1) };
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const password = process.env.OPEN_ASO_PASSWORD;
  if (!password || isPublic(request.nextUrl.pathname, request.headers.get("authorization"))) return NextResponse.next();
  const credentials = decodeBasic(request.headers.get("authorization"));
  const username = process.env.OPEN_ASO_USERNAME;
  if (credentials) {
    const [passwordOk, userOk] = await Promise.all([constantTimeEqual(credentials.password, password), username ? constantTimeEqual(credentials.user, username) : Promise.resolve(true)]);
    if (passwordOk && userOk) return NextResponse.next();
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Open ASO", charset="UTF-8"', "Cache-Control": "no-store" },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|robots.txt).*)"],
};
