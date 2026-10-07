import { authenticateClient, oauthError, oauthJson, preflight, readParams } from "@/lib/oauth/http";
import { exchangeAuthorizationCode, rotateRefreshToken } from "@/lib/oauth/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const OPTIONS = preflight;

export async function POST(req: Request) {
  let params: Record<string, string>;
  try {
    params = await readParams(req);
  } catch (error) {
    return oauthError("invalid_request", error instanceof Error ? error.message : "Invalid body");
  }
  const grantType = params.grant_type;
  if (!grantType) return oauthError("invalid_request", "grant_type is required");
  const client = await authenticateClient(params);
  if (client instanceof Response) return client;
  if (!client.grant_types.includes(grantType)) return oauthError("unauthorized_client", `This client is not registered for ${grantType}`);

  if (grantType === "authorization_code") {
    const { code, code_verifier: verifier, redirect_uri: redirectUri } = params;
    if (!code || !verifier || !redirectUri) return oauthError("invalid_request", "code, code_verifier and redirect_uri are required");
    if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return oauthError("invalid_grant", "code_verifier must be 43-128 unreserved characters");
    const tokens = await exchangeAuthorizationCode({ code, verifier, clientPk: client.id, redirectUri });
    return tokens ? oauthJson(tokens) : oauthError("invalid_grant", "Authorization code is invalid, expired or already used");
  }

  if (grantType === "refresh_token") {
    if (!params.refresh_token) return oauthError("invalid_request", "refresh_token is required");
    const tokens = await rotateRefreshToken({ refreshToken: params.refresh_token, clientPk: client.id });
    return tokens ? oauthJson(tokens) : oauthError("invalid_grant", "Refresh token is invalid, expired or revoked");
  }

  return oauthError("unsupported_grant_type", `Unsupported grant_type: ${grantType}`);
}
