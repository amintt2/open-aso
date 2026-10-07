import { createHash, timingSafeEqual } from "node:crypto";
import { mcpToken } from "./config";

export type AuthResult = { ok: true; mode: "token" | "localhost" } | { ok: false; status: number; message: string };

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

export function safeEqual(a: string, b: string) {
  const same = timingSafeEqual(digest(a), digest(b));
  return same && a.length === b.length;
}

function hostname(value: string | null) {
  if (!value) return null;
  try {
    return new URL(value.includes("://") ? value : `http://${value}`).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isLoopbackHost(value: string | null) {
  const host = hostname(value);
  return !!host && (LOOPBACK_HOSTS.has(host) || host.endsWith(".localhost"));
}

function isLoopbackAddress(address: string) {
  const a = address.trim().toLowerCase().replace(/^\[|\]$/g, "");
  return a === "::1" || a === "localhost" || a.startsWith("127.") || a === "::ffff:127.0.0.1" || a.startsWith("::ffff:127.");
}

export function isLocalRequest(req: Request) {
  const host = req.headers.get("host");
  if (!isLoopbackHost(host)) return false;
  const forwardedHost = req.headers.get("x-forwarded-host");
  if (forwardedHost && !isLoopbackHost(forwardedHost)) return false;
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor && !forwardedFor.split(",").every(isLoopbackAddress)) return false;
  const realIp = req.headers.get("x-real-ip");
  if (realIp && !isLoopbackAddress(realIp)) return false;
  const origin = req.headers.get("origin");
  if (origin && origin !== "null" && !isLoopbackHost(origin)) return false;
  return true;
}

function bearer(req: Request) {
  const header = req.headers.get("authorization");
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export function authorize(req: Request): AuthResult {
  const token = mcpToken();
  if (token) {
    const provided = bearer(req);
    if (!provided) return { ok: false, status: 401, message: "Missing bearer token. Send Authorization: Bearer <token>." };
    if (!safeEqual(provided, token)) return { ok: false, status: 401, message: "Invalid bearer token" };
    return { ok: true, mode: "token" };
  }
  if (process.env.OPEN_ASO_PASSWORD)
    return { ok: false, status: 401, message: "This instance is password protected. Generate an MCP token in Open ASO → MCP Server." };
  if (!isLocalRequest(req))
    return { ok: false, status: 403, message: "Without a token the MCP server only accepts requests from localhost. Generate a token in Open ASO → MCP Server." };
  return { ok: true, mode: "localhost" };
}
