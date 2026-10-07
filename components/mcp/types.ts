import type { McpStats } from "@/lib/mcp/config";
import type { ToolInfo, ToolLayer } from "@/lib/mcp/define";

export type McpSettings = {
  enabled: boolean;
  tokenSet: boolean;
  allowWrites: boolean;
  passwordProtected: boolean;
  layers: { id: ToolLayer; label: string; description: string }[];
  tools: ToolInfo[];
};

export type McpStatus = {
  enabled: boolean;
  tokenSet: boolean;
  allowWrites: boolean;
  authMode: "token" | "localhost" | "blocked";
  stats: McpStats;
};
