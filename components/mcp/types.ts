import type { McpConfig, McpStats } from "@/lib/mcp/config";
import type { ToolInfo, ToolLayer } from "@/lib/mcp/define";

export type McpSettings = McpConfig & {
  canManage: boolean;
  layers: { id: ToolLayer; label: string; description: string }[];
  tools: ToolInfo[];
};

export type McpStatus = McpConfig & { stats: McpStats };

export type McpClient = {
  familyId: string;
  clientName: string;
  logoUri: string | null;
  clientUri: string | null;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  scopes: string[];
  connectedAt: string;
  lastUsedAt: string | null;
  expiresAt: string;
  mine: boolean;
  canRevoke: boolean;
};

export type McpClients = { canManage: boolean; clients: McpClient[] };
