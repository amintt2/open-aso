import { resourceMetadataUrl, publicOrigin } from "@/lib/oauth/origin";
import { canWrite, FULL_SCOPE } from "@/lib/oauth/scopes";
import { revokeWorkspaceGrant, verifyAccessToken } from "@/lib/oauth/tokens";
import { db } from "@/lib/server/db";
import { bearer, workspaceForToken } from "@/lib/server/tokens";
import { mcpEnabled } from "./config";

export type McpPrincipal = {
  kind: "oauth" | "static";
  workspaceId: string;
  scopes: string[];
  readOnly: boolean;
  userId: string | null;
  client: string | null;
};

export type AuthResult = { ok: true; principal: McpPrincipal } | { ok: false; status: number; message: string; workspaceId?: string; challenge?: string };

function challenge(req: Request, error?: { code: string; description: string }) {
  const parts = [`resource_metadata="${resourceMetadataUrl(publicOrigin(req))}"`];
  if (error) parts.unshift(`error="${error.code}"`, `error_description="${error.description.replace(/"/g, "'")}"`);
  return `Bearer ${parts.join(", ")}`;
}

function unauthorized(req: Request, message: string, invalid: boolean): AuthResult {
  return { ok: false, status: 401, message, challenge: challenge(req, invalid ? { code: "invalid_token", description: message } : undefined) };
}

async function resolve(req: Request, token: string): Promise<McpPrincipal | AuthResult> {
  if (token.startsWith("oaso_mcp_")) {
    const workspaceId = await workspaceForToken("mcp", token);
    if (!workspaceId) return unauthorized(req, "Invalid or revoked MCP token", true);
    return { kind: "static", workspaceId, scopes: [FULL_SCOPE], readOnly: false, userId: null, client: null };
  }
  const grant = await verifyAccessToken(token);
  if (!grant) return unauthorized(req, "Invalid or expired access token", true);
  const member = await db.get(`SELECT 1 FROM "member" WHERE "userId" = ? AND "organizationId" = ?`, [grant.userId, grant.workspaceId]);
  if (!member) {
    await revokeWorkspaceGrant(grant.workspaceId, grant.familyId);
    return unauthorized(req, "You are no longer a member of the workspace this connection was granted for. Reconnect and pick another workspace.", true);
  }
  return { kind: "oauth", workspaceId: grant.workspaceId, scopes: grant.scopes, readOnly: !canWrite(grant.scopes), userId: grant.userId, client: grant.clientName };
}

export async function authorize(req: Request): Promise<AuthResult> {
  const token = bearer(req);
  if (!token) return unauthorized(req, "Authentication required. Connect with OAuth (sign in to Open ASO when your client asks) or send Authorization: Bearer <token> from Open ASO → MCP Server.", false);
  const resolved = await resolve(req, token);
  if ("ok" in resolved) return resolved;
  if (!(await mcpEnabled(resolved.workspaceId)))
    return { ok: false, status: 403, workspaceId: resolved.workspaceId, message: "The MCP server is disabled for this workspace. A workspace admin can enable it in Open ASO → MCP Server." };
  return { ok: true, principal: resolved };
}
