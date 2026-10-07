import { oauthJson, preflight } from "@/lib/oauth/http";
import { authorizationServerMetadata } from "@/lib/oauth/metadata";
import { publicOrigin } from "@/lib/oauth/origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const OPTIONS = preflight;

export function GET(req: Request) {
  return oauthJson(authorizationServerMetadata(publicOrigin(req)), 200, { "Cache-Control": "public, max-age=300" });
}
