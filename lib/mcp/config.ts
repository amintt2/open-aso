import { getSetting, setSetting } from "@/lib/server/settings";
import { issueToken, revokeToken, tokenInfo } from "@/lib/server/tokens";

export type McpConfig = { enabled: boolean; tokenSet: boolean; allowWrites: boolean; tokenHint: string | null; tokenCreatedAt: string | null; tokenLastUsedAt: string | null };

export type McpStats = {
  startedAt: string;
  requests: number;
  rejected: number;
  toolCalls: number;
  toolErrors: number;
  lastRequestAt: string | null;
  lastToolAt: string | null;
  lastTool: string | null;
  lastClient: string | null;
  lastRejection: string | null;
};

type GlobalWithMcp = typeof globalThis & { __openAsoMcpStatsByWs?: Map<string, McpStats> };

export async function mcpConfig(workspaceId: string): Promise<McpConfig> {
  const [enabled, allowWrites, token] = await Promise.all([getSetting(workspaceId, "mcp.enabled"), getSetting(workspaceId, "mcp.allowWrites"), tokenInfo(workspaceId, "mcp")]);
  return {
    enabled: enabled === "true",
    allowWrites: allowWrites === "true",
    tokenSet: !!token,
    tokenHint: token?.hint ?? null,
    tokenCreatedAt: token?.created_at ?? null,
    tokenLastUsedAt: token?.last_used_at ?? null,
  };
}

export async function updateMcpConfig(workspaceId: string, patch: { enabled?: boolean; allowWrites?: boolean }) {
  if (patch.enabled !== undefined) await setSetting(workspaceId, "mcp.enabled", patch.enabled ? "true" : null);
  if (patch.allowWrites !== undefined) await setSetting(workspaceId, "mcp.allowWrites", patch.allowWrites ? "true" : null);
  return mcpConfig(workspaceId);
}

export async function rotateMcpToken(workspaceId: string) {
  return issueToken(workspaceId, "mcp");
}

export async function clearMcpToken(workspaceId: string) {
  await revokeToken(workspaceId, "mcp");
}

export async function writesAllowed(workspaceId: string) {
  return (await getSetting(workspaceId, "mcp.allowWrites")) === "true";
}

export async function mcpEnabled(workspaceId: string) {
  return (await getSetting(workspaceId, "mcp.enabled")) === "true";
}

export function mcpStats(workspaceId: string): McpStats {
  const g = globalThis as GlobalWithMcp;
  g.__openAsoMcpStatsByWs ??= new Map();
  let stats = g.__openAsoMcpStatsByWs.get(workspaceId);
  if (!stats) {
    stats = {
      startedAt: new Date().toISOString(),
      requests: 0,
      rejected: 0,
      toolCalls: 0,
      toolErrors: 0,
      lastRequestAt: null,
      lastToolAt: null,
      lastTool: null,
      lastClient: null,
      lastRejection: null,
    };
    g.__openAsoMcpStatsByWs.set(workspaceId, stats);
  }
  return stats;
}

export function recordRequest(workspaceId: string, client: string | null) {
  const stats = mcpStats(workspaceId);
  stats.requests++;
  stats.lastRequestAt = new Date().toISOString();
  if (client) stats.lastClient = client;
}

export function recordRejection(workspaceId: string, reason: string) {
  const stats = mcpStats(workspaceId);
  stats.rejected++;
  stats.lastRejection = `${new Date().toISOString()} · ${reason}`;
}

export function recordToolCall(workspaceId: string, name: string, ok: boolean) {
  const stats = mcpStats(workspaceId);
  stats.toolCalls++;
  if (!ok) stats.toolErrors++;
  stats.lastTool = name;
  stats.lastToolAt = new Date().toISOString();
}
