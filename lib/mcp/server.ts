import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ZodError } from "zod";
import { recordToolCall } from "./config";
import type { McpTool, ToolContext } from "./define";
import { TOOLS } from "./registry";

const INSTRUCTIONS = [
  "Open ASO is an App Store Optimization workspace. This connection is scoped to one workspace: you only see its apps, keywords, credentials and integrations.",
  "Start with list_apps to get appId values; most tools take appId (Open ASO id), App Store tools take trackId.",
  "Countries are two-letter storefront codes (us, gb, de…).",
  "Downloads, revenue and popularity are modeled estimates.",
  "Write tools are guarded: they fail unless a workspace admin enabled writes in Open ASO. Tools with dryRun return a diff first; only apply with dryRun: false and confirm: true after the user approved that diff.",
].join(" ");

const READ_ONLY_NOTE = "This connection was granted read-only access (scope mcp:read), so write tools are not available.";

function errorMessage(error: unknown) {
  if (error instanceof ZodError) return `Invalid input: ${error.issues.map((i) => `${i.path.join(".") || "input"} ${i.message}`).join("; ")}`;
  return error instanceof Error ? error.message : String(error);
}

function text(value: unknown, isError = false): CallToolResult {
  return { content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value) }], ...(isError ? { isError: true } : {}) };
}

async function invoke(tool: McpTool, args: Record<string, unknown>, ctx: ToolContext, readOnly: boolean): Promise<CallToolResult> {
  if (readOnly && tool.write) return text(`Error: ${READ_ONLY_NOTE}`, true);
  try {
    const data = await tool.run(args, ctx);
    recordToolCall(ctx.workspaceId, tool.name, true);
    return text(data ?? { ok: true });
  } catch (error) {
    recordToolCall(ctx.workspaceId, tool.name, false);
    return text(`Error: ${errorMessage(error)}`, true);
  }
}

export function createMcpServer(ctx: ToolContext, options: { readOnly?: boolean } = {}) {
  const readOnly = options.readOnly ?? false;
  const server = new McpServer({ name: "open-aso", title: "Open ASO", version: "0.3.0" }, { instructions: readOnly ? `${INSTRUCTIONS} ${READ_ONLY_NOTE}` : INSTRUCTIONS, capabilities: { tools: {} } });
  for (const tool of TOOLS) {
    if (readOnly && tool.write) continue;
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.input,
        annotations: { title: tool.title, readOnlyHint: !tool.write, destructiveHint: tool.write, idempotentHint: !tool.write, openWorldHint: true },
      },
      (args: Record<string, unknown>) => invoke(tool, args, ctx, readOnly),
    );
  }
  return server;
}
