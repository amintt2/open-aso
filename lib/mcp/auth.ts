import { bearer, workspaceForToken } from "@/lib/server/tokens";
import { mcpEnabled } from "./config";

export type AuthResult = { ok: true; workspaceId: string } | { ok: false; status: number; message: string; workspaceId?: string };

export async function authorize(req: Request): Promise<AuthResult> {
  const token = bearer(req);
  if (!token) return { ok: false, status: 401, message: "Missing bearer token. Send Authorization: Bearer <token> (create one in Open ASO → MCP Server)." };
  const workspaceId = await workspaceForToken("mcp", token);
  if (!workspaceId) return { ok: false, status: 401, message: "Invalid or revoked MCP token" };
  if (!(await mcpEnabled(workspaceId)))
    return { ok: false, status: 403, workspaceId, message: "The MCP server is disabled for this workspace. Enable it in Open ASO → MCP Server." };
  return { ok: true, workspaceId };
}
