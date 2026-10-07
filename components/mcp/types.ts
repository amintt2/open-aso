import type { McpConfig, McpStats } from "@/lib/mcp/config";
import type { ToolInfo, ToolLayer } from "@/lib/mcp/define";

export type McpSettings = McpConfig & {
  canManage: boolean;
  layers: { id: ToolLayer; label: string; description: string }[];
  tools: ToolInfo[];
};

export type McpStatus = McpConfig & { stats: McpStats };
