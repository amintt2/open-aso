import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { findClient } from "@/lib/oauth/http";
import { publicOrigin } from "@/lib/oauth/origin";
import { grantScopes, READ_SCOPE } from "@/lib/oauth/scopes";
import { createAuthorizationCode } from "@/lib/oauth/tokens";
import { db } from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function back(redirect: URL, params: Record<string, string>) {
  for (const [k, v] of Object.entries(params)) if (v) redirect.searchParams.set(k, v);
  return NextResponse.redirect(redirect, 303);
}

function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin || origin === "null") return !origin;
  const allowed = new Set([publicOrigin(req), new URL(req.url).origin]);
  return allowed.has(origin);
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "invalid_request", error_description: "Cross-origin consent is not allowed" }, { status: 403 });
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ error: "unauthenticated", error_description: "Sign in to Open ASO first" }, { status: 401 });

  const form = await req.formData();
  const field = (name: string) => {
    const v = form.get(name);
    return typeof v === "string" ? v : "";
  };
  const client = await findClient(field("client_id"));
  if (!client) return NextResponse.json({ error: "invalid_client" }, { status: 400 });
  const redirectUri = field("redirect_uri");
  if (!client.redirect_uris.includes(redirectUri)) return NextResponse.json({ error: "invalid_request", error_description: "redirect_uri is not registered for this client" }, { status: 400 });
  const redirect = new URL(redirectUri);
  const state = field("state");
  const iss = publicOrigin(req);

  if (field("decision") !== "approve") return back(redirect, { error: "access_denied", state, iss });

  const challenge = field("code_challenge");
  if (!/^[A-Za-z0-9_-]{43}$/.test(challenge) || field("code_challenge_method") !== "S256")
    return back(redirect, { error: "invalid_request", error_description: "PKCE with S256 is required", state, iss });

  const workspaceId = field("workspace_id");
  const member = workspaceId && (await db.get(`SELECT 1 FROM "member" WHERE "userId" = ? AND "organizationId" = ?`, [session.user.id, workspaceId]));
  if (!member) return back(redirect, { error: "access_denied", error_description: "You are not a member of the selected workspace", state, iss });

  const granted = grantScopes(field("scope"), client.scopes);
  if (!granted) return back(redirect, { error: "invalid_scope", error_description: "Requested scope is not registered for this client", state, iss });
  const scopes = field("access") === "read" ? [READ_SCOPE] : granted;

  const code = await createAuthorizationCode({
    clientPk: client.id,
    userId: session.user.id,
    workspaceId,
    redirectUri,
    scopes,
    codeChallenge: challenge,
    resource: field("resource") || null,
  });
  return back(redirect, { code, state, iss });
}
