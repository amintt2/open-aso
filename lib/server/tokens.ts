import { db } from "./db";
import { hashToken, newToken } from "./crypto";

export type TokenKind = "sdk" | "revenuecat" | "mcp" | "superwall";

const PREFIX: Record<TokenKind, string> = { sdk: "oaso_sdk", revenuecat: "oaso_rc", mcp: "oaso_mcp", superwall: "oaso_sw" };

export async function issueToken(workspaceId: string, kind: TokenKind) {
  const token = newToken(PREFIX[kind]);
  await db.run(
    `INSERT INTO api_tokens (workspace_id, kind, token_hash, hint, created_at) VALUES (?, ?, ?, ?, now())
     ON CONFLICT (workspace_id, kind) DO UPDATE SET token_hash = excluded.token_hash, hint = excluded.hint, created_at = now(), last_used_at = NULL`,
    [workspaceId, kind, hashToken(token), `${token.slice(0, 12)}…${token.slice(-4)}`],
  );
  return token;
}

export async function revokeToken(workspaceId: string, kind: TokenKind) {
  await db.run("DELETE FROM api_tokens WHERE workspace_id = ? AND kind = ?", [workspaceId, kind]);
}

export async function tokenInfo(workspaceId: string, kind: TokenKind) {
  return (
    (await db.get<{ hint: string; created_at: string; last_used_at: string | null }>(
      "SELECT hint, created_at, last_used_at FROM api_tokens WHERE workspace_id = ? AND kind = ?",
      [workspaceId, kind],
    )) ?? null
  );
}

export async function workspaceForToken(kind: TokenKind, token: string | null | undefined) {
  if (!token) return null;
  const row = await db.get<{ workspace_id: string }>("SELECT workspace_id FROM api_tokens WHERE kind = ? AND token_hash = ?", [kind, hashToken(token.trim())]);
  if (!row) return null;
  await db.run("UPDATE api_tokens SET last_used_at = now() WHERE kind = ? AND token_hash = ?", [kind, hashToken(token.trim())]);
  return row.workspace_id;
}

export function bearer(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  return header.replace(/^Bearer\s+/i, "").trim() || null;
}
