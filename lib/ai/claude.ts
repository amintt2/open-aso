import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/server/db";
import { workspaceLimits } from "@/lib/server/plans";
import { getSetting } from "@/lib/server/settings";

export const DEFAULT_MODEL = "claude-opus-5-5";

export const AI_MODELS = [
  { id: "claude-opus-5-5", label: "Claude Opus 5.5" },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
];

const FALLBACK_MODELS = new Set(["claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"]);
const ADAPTIVE_MODELS = new Set(["claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"]);

export class AiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function aiAvailable(workspaceId: string) {
  return !!(await getSetting(workspaceId, "ai.anthropicKey"));
}

export async function aiModel(workspaceId: string) {
  return (await getSetting(workspaceId, "ai.model"))?.trim() || DEFAULT_MODEL;
}

export async function aiUsage(workspaceId: string) {
  const [row, limits] = await Promise.all([
    db.get<{ count: number }>("SELECT count FROM ai_usage WHERE workspace_id = ? AND day = current_date", [workspaceId]),
    workspaceLimits(workspaceId),
  ]);
  return { used: row?.count ?? 0, limit: limits.aiRequestsPerDay };
}

async function consumeRequest(workspaceId: string) {
  const { aiRequestsPerDay } = await workspaceLimits(workspaceId);
  const row = await db.get<{ count: number }>(
    `INSERT INTO ai_usage (workspace_id, day, count) VALUES (?, current_date, 1)
     ON CONFLICT (workspace_id, day) DO UPDATE SET count = ai_usage.count + 1 WHERE ai_usage.count < ?
     RETURNING count`,
    [workspaceId, aiRequestsPerDay],
  );
  if (!row || row.count > aiRequestsPerDay)
    throw new AiError(`Your plan allows ${aiRequestsPerDay} AI requests per day. Try again tomorrow or upgrade.`, 429);
}

async function refundRequest(workspaceId: string) {
  await db.run("UPDATE ai_usage SET count = greatest(count - 1, 0) WHERE workspace_id = ? AND day = current_date", [workspaceId]).catch(() => undefined);
}

function apiError(error: unknown) {
  if (error instanceof Anthropic.AuthenticationError) return new AiError("The Anthropic API key was rejected", 400);
  if (error instanceof Anthropic.RateLimitError) return new AiError("Anthropic rate limit reached, try again shortly", 429);
  if (error instanceof Anthropic.APIError) return new AiError(`Anthropic API: ${error.message}`, 502);
  return error;
}

async function client(workspaceId: string) {
  const apiKey = await getSetting(workspaceId, "ai.anthropicKey");
  if (!apiKey) throw new AiError("Add an Anthropic API key in Settings to enable AI features", 400);
  return new Anthropic({ apiKey, timeout: 180000, maxRetries: 2 });
}

export async function generateJson<T>(
  workspaceId: string,
  input: {
    prompt: string;
    system?: string;
    schema: Record<string, unknown>;
    effort?: "low" | "medium" | "high";
    maxTokens?: number;
  },
): Promise<{ data: T; model: string }> {
  const [anthropic, model] = await Promise.all([client(workspaceId), aiModel(workspaceId)]);
  const withFallback = FALLBACK_MODELS.has(model);
  const adaptive = ADAPTIVE_MODELS.has(model);
  await consumeRequest(workspaceId);
  const response = await anthropic.beta.messages
    .create({
      model,
      max_tokens: input.maxTokens ?? 16000,
      ...(input.system ? { system: input.system } : {}),
      ...(withFallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
      output_config: {
        ...(adaptive ? { effort: input.effort ?? "low" } : {}),
        format: { type: "json_schema", schema: input.schema },
      },
      messages: [{ role: "user", content: input.prompt }],
    })
    .catch(async (error: unknown) => {
      await refundRequest(workspaceId);
      throw apiError(error);
    });
  if (response.stop_reason === "refusal") throw new AiError("The model declined this request", 502);
  if (response.stop_reason === "max_tokens") throw new AiError("The AI response was cut off before it finished", 502);
  const text = response.content
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
  try {
    return { data: JSON.parse(text) as T, model: response.model };
  } catch {
    throw new AiError("Could not parse the AI response", 502);
  }
}
