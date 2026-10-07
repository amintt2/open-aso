import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ZodError } from "zod";
import { recordToolCall } from "./config";
import type { McpTool } from "./define";
import { TOOLS } from "./registry";

const INSTRUCTIONS = [
  "Open ASO is a local App Store Optimization workspace.",
  "Start with list_apps to get appId values; most tools take appId (Open ASO id), App Store tools take trackId.",
  "Countries are two-letter storefront codes (us, gb, de…).",
  "Downloads, revenue and popularity are modeled estimates.",
  "Write tools are guarded: they fail unless the user enabled writes in Open ASO. Tools with dryRun return a diff first; only apply with dryRun: false and confirm: true after the user approved that diff.",
].join(" ");

function errorMessage(error: unknown) {
  if (error instanceof ZodError) return `Invalid input: ${error.issues.map((i) => `${i.path.join(".") || "input"} ${i.message}`).join("; ")}`;
  return error instanceof Error ? error.message : String(error);
}

function text(value: unknown, isError = false): CallToolResult {
  return { content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value) }], ...(isError ? { isError: true } : {}) };
}

async function invoke(tool: McpTool, args: Record<string, unknown>): Promise<CallToolResult> {
  try {
    const data = await tool.run(args);
    recordToolCall(tool.name, true);
    return text(data ?? { ok: true });
  } catch (error) {
    recordToolCall(tool.name, false);
    return text(`Error: ${errorMessage(error)}`, true);
  }
}

export function createMcpServer() {
  const server = new McpServer({ name: "open-aso", title: "Open ASO", version: "0.1.0" }, { instructions: INSTRUCTIONS, capabilities: { tools: {} } });
  for (const tool of TOOLS) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.input,
        annotations: { title: tool.title, readOnlyHint: !tool.write, destructiveHint: tool.write, openWorldHint: true },
      },
      (args: Record<string, unknown>) => invoke(tool, args),
    );
  }
  return server;
}
