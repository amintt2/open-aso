import { oauthError, oauthJson, preflight } from "@/lib/oauth/http";
import { protectedResourceMetadata } from "@/lib/oauth/metadata";
import { publicOrigin } from "@/lib/oauth/origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const OPTIONS = preflight;

const RESOURCES = new Set(["api/mcp", "api/mcp/mcp"]);

export async function GET(req: Request, { params }: { params: Promise<{ resource: string[] }> }) {
  const path = (await params).resource.join("/").replace(/\/+$/, "");
  if (!RESOURCES.has(path)) return oauthError("not_found", "No protected resource at this path", 404);
  const origin = publicOrigin(req);
  return oauthJson(protectedResourceMetadata(origin, `${origin}/${path}`), 200, { "Cache-Control": "public, max-age=300" });
}
