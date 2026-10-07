import { getCountry } from "@/lib/appstore/countries";
import { normalizeTerm } from "@/lib/aso/scoring";
import { getSetting } from "@/lib/server/settings";

const DEFAULT_MODEL = "claude-sonnet-5-5";
const FALLBACK_MODELS = new Set(["claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"]);

export function aiAvailable() {
  return !!getSetting("ai.anthropicKey");
}

type AiInput = {
  title: string;
  subtitle: string | null;
  description: string;
  genre: string | undefined;
  country: string;
  tracked: string[];
  competitors: string[];
};

type MessagesResponse = {
  stop_reason?: string;
  content?: { type: string; text?: string }[];
  error?: { message?: string };
};

const SCHEMA = {
  type: "object",
  properties: { keywords: { type: "array", items: { type: "string" } } },
  required: ["keywords"],
  additionalProperties: false,
};

function prompt(input: AiInput) {
  const c = getCountry(input.country);
  const language = c.indexedLocales[0] ?? c.lang;
  return [
    `Suggest 40 App Store search keywords for the app below, for the ${c.name} storefront. Write them in the language users there search in (primary locale ${language}).`,
    "Each keyword must be a realistic phrase people type into App Store search: 1-3 words, lowercase, no brand names of other companies, no duplicates of the already tracked keywords.",
    "Mix head terms with specific long-tail phrases that describe features, use cases and audiences of the app.",
    "",
    `Title: ${input.title}`,
    input.subtitle ? `Subtitle: ${input.subtitle}` : "",
    input.genre ? `Category: ${input.genre}` : "",
    `Description: ${input.description.slice(0, 2500)}`,
    `Already tracked: ${input.tracked.join(", ") || "none"}`,
    input.competitors.length ? `Competitors: ${input.competitors.join(", ")}` : "",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

export async function aiCandidates(input: AiInput): Promise<string[]> {
  const key = getSetting("ai.anthropicKey");
  if (!key) return [];
  const model = getSetting("ai.model") || DEFAULT_MODEL;
  const useFallbacks = FALLBACK_MODELS.has(model);
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-api-key": key,
    "anthropic-version": "2023-06-01",
  };
  if (useFallbacks) headers["anthropic-beta"] = "server-side-fallback-2026-07-01";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers,
    signal: AbortSignal.timeout(120000),
    body: JSON.stringify({
      model,
      max_tokens: 16000,
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      ...(useFallbacks ? { fallbacks: "default" } : {}),
      messages: [{ role: "user", content: prompt(input) }],
    }),
  });
  const data = (await res.json().catch(() => ({}))) as MessagesResponse;
  if (!res.ok) throw new Error(data.error?.message ?? `Anthropic API responded ${res.status}`);
  if (data.stop_reason === "refusal") throw new Error("The model declined to suggest keywords");
  const text = (data.content ?? [])
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text)
    .join("");
  const parsed = JSON.parse(text) as { keywords?: unknown };
  const list = Array.isArray(parsed.keywords) ? parsed.keywords : [];
  return [...new Set(list.filter((k): k is string => typeof k === "string").map(normalizeTerm).filter(Boolean))];
}
