import { z } from "zod";
import { mcpConfig, updateMcpConfig } from "@/lib/mcp/config";
import { mcpConnect } from "@/lib/mcp/connect";
import { LAYERS } from "@/lib/mcp/define";
import { toolCatalog } from "@/lib/mcp/registry";
import { requireWorkspace } from "@/lib/server/context";
import { body, json, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

async function payload(req: Request, workspaceId: string, role: string) {
  return { ...(await mcpConfig(workspaceId)), canManage: role !== "member", connect: mcpConnect(req), layers: LAYERS, tools: toolCatalog() };
}

export const GET = route(async (req) => {
  const { workspaceId, role } = await requireWorkspace();
  return json(await payload(req, workspaceId, role));
});

export const PUT = route(async (req) => {
  const { workspaceId, role } = await requireWorkspace("admin");
  const input = await body(req, z.object({ enabled: z.boolean().optional(), allowWrites: z.boolean().optional() }));
  await updateMcpConfig(workspaceId, input);
  return json(await payload(req, workspaceId, role));
});
