import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z, ZodError } from "zod";
import { CODE_LIMITS, runCode, toolSignature } from "./code-mode";
import { recordToolCall } from "./config";
import type { McpTool, ToolContext } from "./define";
import { TOOLS } from "./registry";

const INSTRUCTIONS = [
  "Open ASO is an App Store Optimization workspace. This connection is scoped to one workspace: you only see its apps, keywords, credentials and integrations.",
  "Start with list_apps to get appId values; most tools take appId (Open ASO id), App Store tools take trackId.",
  "Countries are two-letter storefront codes (us, gb, de…).",
  "Downloads, revenue and popularity are modeled estimates.",
  "When a question needs several calls, loops over apps/countries/terms, or any arithmetic (sums, ratios, comparisons, joins between PostHog, App Store and keyword data), prefer run_code: one script calls the other tools as functions and only what it returns enters your context.",
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

function codeModeDescription(readOnly: boolean) {
  const tools = TOOLS.filter((t) => !(readOnly && t.write));
  return [
    "Code mode: run a JavaScript script (body of an async function) that calls Open ASO tools as functions and return only what you need. Use it instead of many separate tool calls, for loops over apps/countries/terms, and for any math or joins across data sources. Nothing but the returned value and console.log output comes back, so aggregate, filter and slice inside the script.",
    `Call a tool with \`await tools.<name>(args)\`; it returns the same parsed JSON the tool returns on its own (errors throw, catch them with try/catch). Calls run in parallel up to ${CODE_LIMITS.concurrency} at a time, so use Promise.all for fan-out. Read results are cached per workspace for 10 minutes across runs, so a follow-up script can recompute from the same data without refetching; pass { fresh: true } as a second argument to bypass it (calls marked cached: true in the report). Helpers: sum(xs, f?), avg(xs, f?), groupBy(xs, keyOrFn), pick(objOrArray, keys), console.log. Limits: ${CODE_LIMITS.timeoutMs / 1000}s, ${CODE_LIMITS.maxCalls} tool calls, 64 MB, result capped at ${CODE_LIMITS.maxResultChars} characters. Sandboxed QuickJS: no fetch, require, filesystem or timers. Write tools keep their own dryRun/confirm rules.`,
    "Example: const apps = await tools.list_apps(); const rows = await Promise.all(['us','fr','vn'].map(c => tools.search_rankings({ appId: 1, country: c, terms: ['tally counter','tasbih'] }))); return rows.map(r => ({ country: r.country, ranked: r.rankings.filter(x => x.position).length }));",
    "Unsure of a result's shape? Return Object.keys(result) or a single row first.",
    "Available tools:",
    ...tools.map((t) => `- ${toolSignature(t)}`),
  ].join("\n");
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
  server.registerTool(
    "run_code",
    {
      title: "Run a script over Open ASO (code mode)",
      description: codeModeDescription(readOnly),
      inputSchema: { code: z.string().min(1).max(CODE_LIMITS.maxCodeChars).describe("JavaScript: the body of an async function. Use await tools.<name>(args) and end with return <value>.") },
      annotations: { title: "Run a script over Open ASO", readOnlyHint: readOnly, destructiveHint: !readOnly, idempotentHint: false, openWorldHint: true },
    },
    async ({ code }: { code: string }) => {
      const result = await runCode(code, ctx, { tools: TOOLS, readOnly });
      recordToolCall(ctx.workspaceId, "run_code", result.ok);
      return text(result, !result.ok);
    },
  );
  return server;
}
