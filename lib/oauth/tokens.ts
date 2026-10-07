import { createHash, randomBytes } from "node:crypto";
import { hashToken } from "@/lib/server/crypto";
import { db, type Queryable } from "@/lib/server/db";

export const ACCESS_TTL = 60 * 60;
export const REFRESH_TTL = 60 * 60 * 24 * 30;
const CODE_TTL = 60 * 10;

export const OAUTH_PREFIX = { access: "oaso_at_", refresh: "oaso_rt_", code: "oaso_ac_", client: "oaso_client_", registration: "oaso_reg_" } as const;

export type TokenPair = { access_token: string; refresh_token: string; token_type: "Bearer"; expires_in: number; scope: string };

export type AccessGrant = { tokenId: number; familyId: string; userId: string; workspaceId: string; clientId: string; clientName: string; scopes: string[] };

type Grant = { client_id: number; user_id: string; workspace_id: string; scopes: string[]; family_id: string };

export function randomSecret(prefix: string, bytes = 32) {
  return `${prefix}${randomBytes(bytes).toString("base64url")}`;
}

function s256(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

async function isMember(q: Queryable, userId: string, workspaceId: string) {
  return !!(await q.get(`SELECT 1 FROM "member" WHERE "userId" = ? AND "organizationId" = ?`, [userId, workspaceId]));
}

async function revokeFamily(q: Queryable, familyId: string) {
  await q.run("UPDATE oauth_tokens SET revoked_at = now() WHERE family_id = ?::uuid AND revoked_at IS NULL", [familyId]);
}

async function cleanup() {
  await db.run("DELETE FROM oauth_authorizations WHERE consumed_at IS NULL AND expires_at < now() - interval '1 day'");
  await db.run("DELETE FROM oauth_tokens WHERE expires_at < now() - interval '1 day'");
}

export async function createAuthorizationCode(input: {
  clientPk: number;
  userId: string;
  workspaceId: string;
  redirectUri: string;
  scopes: string[];
  codeChallenge: string;
  resource: string | null;
}) {
  await cleanup().catch(() => undefined);
  const code = randomSecret(OAUTH_PREFIX.code);
  await db.run(
    `INSERT INTO oauth_authorizations (code_hash, client_id, user_id, workspace_id, redirect_uri, scopes, code_challenge, resource, expires_at)
     VALUES (?, ?, ?, ?, ?, ?::text[], ?, ?, now() + make_interval(secs => ?))`,
    [hashToken(code), input.clientPk, input.userId, input.workspaceId, input.redirectUri, input.scopes, input.codeChallenge, input.resource, CODE_TTL],
  );
  return code;
}

async function issuePair(q: Queryable, grant: Grant): Promise<TokenPair> {
  const access = randomSecret(OAUTH_PREFIX.access);
  const refresh = randomSecret(OAUTH_PREFIX.refresh);
  const row = await q.get<{ id: number }>(
    `INSERT INTO oauth_tokens (token_hash, kind, family_id, client_id, user_id, workspace_id, scopes, expires_at)
     VALUES (?, 'access', ?::uuid, ?, ?, ?, ?::text[], now() + make_interval(secs => ?)) RETURNING id`,
    [hashToken(access), grant.family_id, grant.client_id, grant.user_id, grant.workspace_id, grant.scopes, ACCESS_TTL],
  );
  await q.run(
    `INSERT INTO oauth_tokens (token_hash, kind, family_id, client_id, user_id, workspace_id, scopes, parent_token_id, expires_at)
     VALUES (?, 'refresh', ?::uuid, ?, ?, ?, ?::text[], ?, now() + make_interval(secs => ?))`,
    [hashToken(refresh), grant.family_id, grant.client_id, grant.user_id, grant.workspace_id, grant.scopes, row!.id, REFRESH_TTL],
  );
  return { access_token: access, refresh_token: refresh, token_type: "Bearer", expires_in: ACCESS_TTL, scope: grant.scopes.join(" ") };
}

export async function exchangeAuthorizationCode(input: { code: string; verifier: string; clientPk: number; redirectUri: string }) {
  return db.tx(async (t) => {
    const row = await t.get<Grant & { id: number; redirect_uri: string; code_challenge: string; consumed_at: string | null; expires_at: string }>(
      `SELECT id, family_id, client_id, user_id, workspace_id, scopes, redirect_uri, code_challenge, consumed_at, expires_at
       FROM oauth_authorizations WHERE code_hash = ? FOR UPDATE`,
      [hashToken(input.code)],
    );
    if (!row || row.client_id !== input.clientPk || row.redirect_uri !== input.redirectUri) return null;
    if (s256(input.verifier) !== row.code_challenge) return null;
    if (row.consumed_at) {
      await revokeFamily(t, row.family_id);
      return null;
    }
    if (new Date(row.expires_at).getTime() <= Date.now()) return null;
    if (!(await isMember(t, row.user_id, row.workspace_id))) return null;
    await t.run("UPDATE oauth_authorizations SET consumed_at = now() WHERE id = ?", [row.id]);
    return issuePair(t, row);
  });
}

export async function rotateRefreshToken(input: { refreshToken: string; clientPk: number }) {
  return db.tx(async (t) => {
    const row = await t.get<Grant & { id: number; parent_token_id: number | null; revoked_at: string | null; expires_at: string }>(
      `SELECT id, family_id, client_id, user_id, workspace_id, scopes, parent_token_id, revoked_at, expires_at
       FROM oauth_tokens WHERE token_hash = ? AND kind = 'refresh' FOR UPDATE`,
      [hashToken(input.refreshToken)],
    );
    if (!row || row.client_id !== input.clientPk) return null;
    if (row.revoked_at) {
      await revokeFamily(t, row.family_id);
      return null;
    }
    if (new Date(row.expires_at).getTime() <= Date.now()) return null;
    if (!(await isMember(t, row.user_id, row.workspace_id))) {
      await revokeFamily(t, row.family_id);
      return null;
    }
    await t.run("UPDATE oauth_tokens SET revoked_at = now() WHERE id = ?", [row.id]);
    if (row.parent_token_id) await t.run("UPDATE oauth_tokens SET revoked_at = now() WHERE id = ? AND revoked_at IS NULL", [row.parent_token_id]);
    return issuePair(t, row);
  });
}

export async function verifyAccessToken(token: string): Promise<AccessGrant | null> {
  if (!token.startsWith(OAUTH_PREFIX.access)) return null;
  const row = await db.get<{ id: number; family_id: string; user_id: string; workspace_id: string; scopes: string[]; client_id: string; client_name: string }>(
    `SELECT t.id, t.family_id, t.user_id, t.workspace_id, t.scopes, c.client_id, c.client_name
     FROM oauth_tokens t JOIN oauth_clients c ON c.id = t.client_id
     WHERE t.token_hash = ? AND t.kind = 'access' AND t.revoked_at IS NULL AND t.expires_at > now()`,
    [hashToken(token)],
  );
  if (!row) return null;
  void db.run("UPDATE oauth_tokens SET last_used_at = now() WHERE id = ?", [row.id]).catch(() => undefined);
  return { tokenId: row.id, familyId: row.family_id, userId: row.user_id, workspaceId: row.workspace_id, clientId: row.client_id, clientName: row.client_name, scopes: row.scopes };
}

export async function revokeOAuthToken(token: string, clientPk: number) {
  const row = await db.get<{ id: number; kind: "access" | "refresh"; family_id: string; client_id: number }>(
    "SELECT id, kind, family_id, client_id FROM oauth_tokens WHERE token_hash = ?",
    [hashToken(token)],
  );
  if (!row || row.client_id !== clientPk) return false;
  if (row.kind === "refresh") await revokeFamily(db, row.family_id);
  else await db.run("UPDATE oauth_tokens SET revoked_at = now() WHERE id = ? AND revoked_at IS NULL", [row.id]);
  return true;
}

export async function introspectToken(token: string, clientPk: number, hint?: string) {
  const rows = await db.all<{ kind: "access" | "refresh"; client_id: number; user_id: string; workspace_id: string; scopes: string[]; expires_at: string; created_at: string; revoked_at: string | null }>(
    "SELECT kind, client_id, user_id, workspace_id, scopes, expires_at, created_at, revoked_at FROM oauth_tokens WHERE token_hash = ?",
    [hashToken(token)],
  );
  const row = rows.find((r) => (hint === "refresh_token" ? r.kind === "refresh" : true)) ?? rows[0];
  if (!row || row.revoked_at || new Date(row.expires_at).getTime() <= Date.now() || row.client_id !== clientPk) return null;
  if (!(await isMember(db, row.user_id, row.workspace_id))) return null;
  return row;
}

export type OAuthGrantRow = {
  familyId: string;
  clientName: string;
  logoUri: string | null;
  clientUri: string | null;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  scopes: string[];
  connectedAt: string;
  lastUsedAt: string | null;
  expiresAt: string;
};

export async function listWorkspaceGrants(workspaceId: string): Promise<OAuthGrantRow[]> {
  return db.all<OAuthGrantRow>(
    `SELECT r.family_id AS "familyId", c.client_name AS "clientName", c.logo_uri AS "logoUri", c.client_uri AS "clientUri",
            r.user_id AS "userId", u.name AS "userName", u.email AS "userEmail", r.scopes,
            COALESCE(a.created_at, r.created_at) AS "connectedAt",
            (SELECT max(x.last_used_at) FROM oauth_tokens x WHERE x.family_id = r.family_id AND x.workspace_id = r.workspace_id) AS "lastUsedAt",
            r.expires_at AS "expiresAt"
     FROM oauth_tokens r
     JOIN oauth_clients c ON c.id = r.client_id
     JOIN "user" u ON u.id = r.user_id
     LEFT JOIN oauth_authorizations a ON a.family_id = r.family_id
     WHERE r.workspace_id = ? AND r.kind = 'refresh' AND r.revoked_at IS NULL AND r.expires_at > now()
     ORDER BY 10 DESC NULLS LAST, 9 DESC`,
    [workspaceId],
  );
}

export async function revokeWorkspaceGrant(workspaceId: string, familyId: string, onlyUserId?: string) {
  const params: unknown[] = [workspaceId, familyId];
  if (onlyUserId) params.push(onlyUserId);
  return db.run(
    `UPDATE oauth_tokens SET revoked_at = now() WHERE workspace_id = ? AND family_id = ?::uuid AND revoked_at IS NULL${onlyUserId ? " AND user_id = ?" : ""}`,
    params,
  );
}
