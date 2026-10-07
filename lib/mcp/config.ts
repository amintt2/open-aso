import { randomBytes } from "node:crypto";
import { getSetting, setSetting } from "@/lib/server/settings";

export type McpConfig = { enabled: boolean; tokenSet: boolean; allowWrites: boolean };

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

type GlobalWithMcp = typeof globalThis & { __openAsoMcpStats?: McpStats };

export function mcpConfig(): McpConfig {
  return {
    enabled: getSetting("mcp.enabled") === "true",
    tokenSet: !!getSetting("mcp.token"),
    allowWrites: getSetting("mcp.allowWrites") === "true",
  };
}

export function updateMcpConfig(patch: { enabled?: boolean; allowWrites?: boolean }): McpConfig {
  if (patch.enabled !== undefined) setSetting("mcp.enabled", patch.enabled ? "true" : null);
  if (patch.allowWrites !== undefined) setSetting("mcp.allowWrites", patch.allowWrites ? "true" : null);
  return mcpConfig();
}

export function rotateMcpToken(): string {
  const token = `oaso_${randomBytes(24).toString("base64url")}`;
  setSetting("mcp.token", token);
  return token;
}

export function clearMcpToken() {
  setSetting("mcp.token", null);
}

export function mcpToken(): string | undefined {
  return getSetting("mcp.token");
}

export function writesAllowed() {
  return getSetting("mcp.allowWrites") === "true";
}

export function mcpStats(): McpStats {
  const g = globalThis as GlobalWithMcp;
  if (!g.__openAsoMcpStats)
    g.__openAsoMcpStats = {
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
  return g.__openAsoMcpStats;
}

export function recordRequest(client: string | null) {
  const stats = mcpStats();
  stats.requests++;
  stats.lastRequestAt = new Date().toISOString();
  if (client) stats.lastClient = client;
}

export function recordRejection(reason: string) {
  const stats = mcpStats();
  stats.rejected++;
  stats.lastRejection = `${new Date().toISOString()} · ${reason}`;
}

export function recordToolCall(name: string, ok: boolean) {
  const stats = mcpStats();
  stats.toolCalls++;
  if (!ok) stats.toolErrors++;
  stats.lastTool = name;
  stats.lastToolAt = new Date().toISOString();
}
