import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { authorize, type McpPrincipal } from "@/lib/mcp/auth";
import { recordRejection, recordRequest } from "@/lib/mcp/config";
import { createMcpServer } from "@/lib/mcp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, accept, mcp-protocol-version, mcp-session-id, last-event-id",
  "Access-Control-Expose-Headers": "www-authenticate, mcp-session-id, mcp-protocol-version",
  "Access-Control-Max-Age": "86400",
};

function withCors(res: Response) {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS)) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

function rpcError(status: number, code: number, message: string, headers: Record<string, string> = {}) {
  return Response.json({ jsonrpc: "2.0", error: { code, message }, id: null }, { status, headers: { ...CORS, "Cache-Control": "no-store", ...headers } });
}

async function gate(req: Request): Promise<McpPrincipal | Response> {
  const auth = await authorize(req);
  if (auth.ok) return auth.principal;
  if (auth.workspaceId) recordRejection(auth.workspaceId, auth.message);
  return rpcError(auth.status, -32001, auth.message, auth.challenge ? { "WWW-Authenticate": auth.challenge } : {});
}

export async function POST(req: Request) {
  const principal = await gate(req);
  if (principal instanceof Response) return principal;
  const { workspaceId } = principal;
  recordRequest(workspaceId, principal.client ?? req.headers.get("user-agent"));
  const server = createMcpServer({ workspaceId }, { readOnly: principal.readOnly });
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  try {
    await server.connect(transport);
    return withCors(await transport.handleRequest(req));
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

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
