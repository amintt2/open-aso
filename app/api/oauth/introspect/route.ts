import { authenticateClient, oauthError, oauthJson, preflight, readParams } from "@/lib/oauth/http";
import { mcpResourceUrl, publicOrigin } from "@/lib/oauth/origin";
import { introspectToken } from "@/lib/oauth/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const OPTIONS = preflight;

const seconds = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

export async function POST(req: Request) {
  let params: Record<string, string>;
  try {
    params = await readParams(req);
  } catch (error) {
    return oauthError("invalid_request", error instanceof Error ? error.message : "Invalid body");
  }
  if (!params.token) return oauthError("invalid_request", "token is required");
  const client = await authenticateClient(params);
  if (client instanceof Response) return client;
  const row = await introspectToken(params.token, client.id, params.token_type_hint);
  if (!row) return oauthJson({ active: false });
  const origin = publicOrigin(req);
  return oauthJson({
    active: true,
    scope: row.scopes.join(" "),
    client_id: client.client_id,
    token_type: row.kind === "refresh" ? "refresh_token" : "Bearer",
    exp: seconds(row.expires_at),
    iat: seconds(row.created_at),
    sub: row.user_id,
    workspace_id: row.workspace_id,
    aud: mcpResourceUrl(origin),
    iss: origin,
  });
}
