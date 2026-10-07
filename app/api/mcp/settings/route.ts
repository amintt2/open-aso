import { z } from "zod";
import { mcpConfig, updateMcpConfig } from "@/lib/mcp/config";
import { LAYERS } from "@/lib/mcp/define";
import { toolCatalog } from "@/lib/mcp/registry";
import { body, json, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

function payload() {
  return { ...mcpConfig(), passwordProtected: !!process.env.OPEN_ASO_PASSWORD, layers: LAYERS, tools: toolCatalog() };
}

export const GET = route(() => json(payload()));

export const PUT = route(async (req) => {
  const input = await body(req, z.object({ enabled: z.boolean().optional(), allowWrites: z.boolean().optional() }));
  updateMcpConfig(input);
  return json(payload());
});
