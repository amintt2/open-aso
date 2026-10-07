import { NextResponse } from "next/server";
import { hashToken, safeEqual } from "@/lib/server/crypto";
import { db } from "@/lib/server/db";

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, mcp-protocol-version",
  "Access-Control-Max-Age": "86400",
};

export function preflight() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export function oauthJson(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(data, { status, headers: { ...CORS_HEADERS, "Cache-Control": "no-store", Pragma: "no-cache", ...headers } });
}

export function oauthError(error: string, description: string, status = 400) {
  return oauthJson({ error, error_description: description }, status);
}

const MAX_BODY = 20_000;

export async function readParams(req: Request): Promise<Record<string, string>> {
  const text = await req.text();
  if (text.length > MAX_BODY) throw new Error("Request body too large");
  const type = req.headers.get("content-type") ?? "";
  let params: Record<string, unknown> = {};
  if (type.includes("application/json")) {
    try {
      params = JSON.parse(text || "{}");
    } catch {
      throw new Error("Body must be valid JSON");
    }
  } else params = Object.fromEntries(new URLSearchParams(text));
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(params ?? {})) if (typeof value === "string") out[key] = value;
  return { ...basicCredentials(req), ...out };
}

function basicCredentials(req: Request): Record<string, string> {
  const header = req.headers.get("authorization") ?? "";
  if (!/^basic\s/i.test(header)) return {};
  try {
    const decoded = Buffer.from(header.slice(6).trim(), "base64").toString("utf8");
    const i = decoded.indexOf(":");
    if (i < 0) return {};
    return { client_id: decodeURIComponent(decoded.slice(0, i)), client_secret: decodeURIComponent(decoded.slice(i + 1)) };
  } catch {
    return {};
  }
}

export type OAuthClient = {
  id: number;
  client_id: string;
  client_secret_hash: string | null;
  client_name: string;
  redirect_uris: string[];
  grant_types: string[];
  scopes: string[];
  logo_uri: string | null;
  client_uri: string | null;
};

export async function findClient(clientId: string | null | undefined) {
  if (!clientId) return null;
  return (
    (await db.get<OAuthClient>(
      "SELECT id, client_id, client_secret_hash, client_name, redirect_uris, grant_types, scopes, logo_uri, client_uri FROM oauth_clients WHERE client_id = ?",
      [clientId],
    )) ?? null
  );
}

export async function authenticateClient(params: Record<string, string>): Promise<OAuthClient | Response> {
  const client = await findClient(params.client_id);
  if (!client) return oauthError("invalid_client", params.client_id ? "Unknown client" : "client_id is required", 401);
  if (client.client_secret_hash) {
    const secret = params.client_secret;
    if (!secret || !safeEqual(hashToken(secret), client.client_secret_hash)) return oauthError("invalid_client", "Invalid client credentials", 401);
  }
  return client;
}
