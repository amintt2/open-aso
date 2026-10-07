import { clearMcpToken, rotateMcpToken } from "@/lib/mcp/config";
import { json, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export const POST = route(() => json({ token: rotateMcpToken() }, { headers: { "Cache-Control": "no-store" } }));

export const DELETE = route(() => {
  clearMcpToken();
  return json({ ok: true });
});
