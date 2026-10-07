import type { z } from "zod";

export type ToolLayer = "aso" | "manage" | "ads" | "analytics";

export const LAYERS: { id: ToolLayer; label: string; description: string }[] = [
  { id: "aso", label: "ASO research", description: "Read-only keyword, ranking, competitor and App Store data." },
  { id: "manage", label: "Keywords & App Store Connect", description: "Manage tracked keywords and App Store Connect metadata. Writes are guarded." },
  { id: "ads", label: "Apple Ads", description: "Campaign performance, diagnostics and guarded bid, budget and keyword changes." },
  { id: "analytics", label: "Analytics", description: "Installs, revenue, retention and keyword ROAS from the SDK and revenue integrations." },
];

export type ToolInfo = { name: string; title: string; layer: ToolLayer; write: boolean; description: string };

export type McpTool = ToolInfo & {
  input: z.ZodRawShape;
  run: (args: Record<string, unknown>) => unknown;
};

type ToolSpec<S extends z.ZodRawShape> = Omit<ToolInfo, "write"> & {
  write?: boolean;
  input: S;
  run: (args: z.output<z.ZodObject<S>>) => unknown;
};

export function defineTool<S extends z.ZodRawShape>(spec: ToolSpec<S>): McpTool {
  return { ...spec, write: spec.write ?? false, run: spec.run as McpTool["run"] };
}

export function toolInfo(tool: McpTool): ToolInfo {
  return { name: tool.name, title: tool.title, layer: tool.layer, write: tool.write, description: tool.description };
}
