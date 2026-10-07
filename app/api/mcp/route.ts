import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { authorize } from "@/lib/mcp/auth";
import { recordRejection, recordRequest } from "@/lib/mcp/config";
import { createMcpServer } from "@/lib/mcp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function rpcError(status: number, code: number, message: string, headers: Record<string, string> = {}) {
  return Response.json({ jsonrpc: "2.0", error: { code, message }, id: null }, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

async function gate(req: Request): Promise<{ workspaceId: string } | Response> {
  const auth = await authorize(req);
  if (auth.ok) return { workspaceId: auth.workspaceId };
  if (auth.workspaceId) recordRejection(auth.workspaceId, auth.message);
  return rpcError(auth.status, -32001, auth.message, auth.status === 401 ? { "WWW-Authenticate": 'Bearer realm="open-aso"' } : {});
}

export async function POST(req: Request) {
  const gated = await gate(req);
  if (gated instanceof Response) return gated;
  const { workspaceId } = gated;
  recordRequest(workspaceId, req.headers.get("user-agent"));
  const server = createMcpServer({ workspaceId });
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  try {
    await server.connect(transport);
    return await transport.handleRequest(req);
  } catch (error) {
    console.error(error);
    return rpcError(500, -32603, error instanceof Error ? error.message : "Internal error");
  } finally {
    void transport.close().catch(() => undefined);
    void server.close().catch(() => undefined);
  }
}

async function notAllowed(req: Request) {
  const gated = await gate(req);
  if (gated instanceof Response) return gated;
  return rpcError(405, -32000, "Method not allowed. This server is stateless: send JSON-RPC messages with POST.", { Allow: "POST" });
}

export const GET = notAllowed;
export const DELETE = notAllowed;
