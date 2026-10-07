import { z } from "zod";
import { hashToken } from "@/lib/server/crypto";
import { db } from "@/lib/server/db";
import { registrationScopes, SUPPORTED_SCOPES } from "./scopes";
import { OAUTH_PREFIX, randomSecret } from "./tokens";

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);
const BLOCKED_SCHEMES = new Set(["javascript:", "data:", "file:", "vbscript:", "about:", "blob:", "ws:", "wss:", "ftp:"]);

export function redirectUriProblem(uri: string): string | null {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return `Invalid URI: ${uri}`;
  }
  if (url.hash) return "redirect_uri must not contain a fragment";
  if (url.protocol === "http:") return LOOPBACK.has(url.hostname) ? null : "http:// redirect URIs are only allowed for localhost / 127.0.0.1";
  if (url.protocol === "https:") return null;
  if (BLOCKED_SCHEMES.has(url.protocol) || !/^[a-z][a-z0-9+.-]*:$/.test(url.protocol)) return `Scheme ${url.protocol} is not allowed`;
  return null;
}

const httpUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => /^https?:\/\//i.test(v), "must be an http(s) URL");

export const registrationSchema = z.object({
  client_name: z.string().trim().min(1).max(200).optional(),
  redirect_uris: z.array(z.string().trim().min(1).max(2000)).min(1).max(20),
  token_endpoint_auth_method: z.enum(["none", "client_secret_post", "client_secret_basic"]).optional(),
  grant_types: z.array(z.string().trim().min(1).max(80)).max(10).optional(),
  response_types: z.array(z.string().trim().min(1).max(40)).max(5).optional(),
  scope: z.string().trim().max(1000).optional(),
  logo_uri: httpUrl.nullish(),
  client_uri: httpUrl.nullish(),
});

export type RegistrationInput = z.infer<typeof registrationSchema>;

export async function registerClient(input: RegistrationInput) {
  const authMethod = input.token_endpoint_auth_method ?? "none";
  const grantTypes = (input.grant_types?.length ? input.grant_types : ["authorization_code", "refresh_token"]).filter((g) => g === "authorization_code" || g === "refresh_token");
  if (!grantTypes.includes("authorization_code")) throw new RegistrationError("invalid_client_metadata", "grant_types must include authorization_code");
  if (input.response_types && !input.response_types.every((r) => r === "code")) throw new RegistrationError("invalid_client_metadata", "Only response_type code is supported");
  for (const uri of input.redirect_uris) {
    const problem = redirectUriProblem(uri);
    if (problem) throw new RegistrationError("invalid_redirect_uri", problem);
  }
  const scopes = registrationScopes(input.scope);
  if (!scopes) throw new RegistrationError("invalid_client_metadata", `Unsupported scope. Supported scopes: ${SUPPORTED_SCOPES.join(", ")}`);
  const clientId = randomSecret(OAUTH_PREFIX.client, 16);
  const secret = authMethod === "none" ? null : randomSecret("", 32);
  const registrationToken = randomSecret(OAUTH_PREFIX.registration, 24);
  const name = input.client_name || "MCP client";
  const row = await db.get<{ created_at: string }>(
    `INSERT INTO oauth_clients (client_id, client_secret_hash, client_name, redirect_uris, grant_types, scopes, token_endpoint_auth_method, logo_uri, client_uri, registration_access_token_hash)
     VALUES (?, ?, ?, ?::text[], ?::text[], ?::text[], ?, ?, ?, ?) RETURNING created_at`,
    [clientId, secret ? hashToken(secret) : null, name, input.redirect_uris, grantTypes, scopes, authMethod, input.logo_uri ?? null, input.client_uri ?? null, hashToken(registrationToken)],
  );
  return {
    client_id: clientId,
    client_id_issued_at: Math.floor(new Date(row!.created_at).getTime() / 1000),
    client_name: name,
    redirect_uris: input.redirect_uris,
    grant_types: grantTypes,
    response_types: ["code"],
    scope: scopes.join(" "),
    token_endpoint_auth_method: authMethod,
    registration_access_token: registrationToken,
    ...(input.logo_uri ? { logo_uri: input.logo_uri } : {}),
    ...(input.client_uri ? { client_uri: input.client_uri } : {}),
    ...(secret ? { client_secret: secret, client_secret_expires_at: 0 } : {}),
  };
}

export class RegistrationError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
