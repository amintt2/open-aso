import Anthropic from "@anthropic-ai/sdk";
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

export function aiAvailable() {
  return !!getSetting("ai.anthropicKey");
}

export function aiModel() {
  return getSetting("ai.model")?.trim() || DEFAULT_MODEL;
}

function client() {
  const apiKey = getSetting("ai.anthropicKey");
  if (!apiKey) throw new AiError("Add an Anthropic API key in Settings to enable AI features", 400);
  return new Anthropic({ apiKey, timeout: 180000, maxRetries: 2 });
}

export async function generateJson<T>(input: {
  prompt: string;
  system?: string;
  schema: Record<string, unknown>;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
}): Promise<{ data: T; model: string }> {
  const model = aiModel();
  const withFallback = FALLBACK_MODELS.has(model);
  const adaptive = ADAPTIVE_MODELS.has(model);
  try {
    const response = await client().beta.messages.create({
      model,
      max_tokens: input.maxTokens ?? 16000,
      ...(input.system ? { system: input.system } : {}),
      ...(withFallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
      output_config: {
        ...(adaptive ? { effort: input.effort ?? "low" } : {}),
        format: { type: "json_schema", schema: input.schema },
      },
      messages: [{ role: "user", content: input.prompt }],
    });
    if (response.stop_reason === "refusal") throw new AiError("The model declined this request", 502);
    if (response.stop_reason === "max_tokens") throw new AiError("The AI response was cut off before it finished", 502);
    const text = response.content
      .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");
    return { data: JSON.parse(text) as T, model: response.model };
  } catch (error) {
    if (error instanceof AiError) throw error;
    if (error instanceof Anthropic.AuthenticationError) throw new AiError("The Anthropic API key was rejected", 400);
    if (error instanceof Anthropic.RateLimitError) throw new AiError("Anthropic rate limit reached, try again shortly", 429);
    if (error instanceof Anthropic.APIError) throw new AiError(`Anthropic API: ${error.message}`, 502);
    if (error instanceof SyntaxError) throw new AiError("Could not parse the AI response", 502);
    throw error;
  }
}
