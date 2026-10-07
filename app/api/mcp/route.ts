import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { authorize } from "@/lib/mcp/auth";
import { mcpConfig, recordRejection, recordRequest } from "@/lib/mcp/config";
import { createMcpServer } from "@/lib/mcp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function rpcError(status: number, code: number, message: string, headers: Record<string, string> = {}) {
  return Response.json({ jsonrpc: "2.0", error: { code, message }, id: null }, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

function gate(req: Request) {
  if (!mcpConfig().enabled) {
    recordRejection("server disabled");
    return rpcError(404, -32000, "The Open ASO MCP server is disabled. Enable it in Open ASO → MCP Server.");
  }
  const auth = authorize(req);
  if (!auth.ok) {
    recordRejection(auth.message);
    return rpcError(auth.status, -32001, auth.message, auth.status === 401 ? { "WWW-Authenticate": 'Bearer realm="open-aso"' } : {});
  }
  return null;
}

export async function POST(req: Request) {
  const blocked = gate(req);
  if (blocked) return blocked;
  recordRequest(req.headers.get("user-agent"));
  const server = createMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  try {
    await server.connect(transport);
    const response = await transport.handleRequest(req);
    return response;
  } catch (error) {
    console.error(error);
    return rpcError(500, -32603, error instanceof Error ? error.message : "Internal error");
  } finally {
    void transport.close().catch(() => undefined);
    void server.close().catch(() => undefined);
  }
}

function notAllowed(req: Request) {
  const blocked = gate(req);
  if (blocked) return blocked;
  return rpcError(405, -32000, "Method not allowed. This server is stateless: send JSON-RPC messages with POST.", { Allow: "POST" });
}

export const GET = notAllowed;
export const DELETE = notAllowed;
