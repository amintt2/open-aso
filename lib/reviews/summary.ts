import { cached, DAY } from "@/lib/server/cache";
import { HttpError } from "@/lib/server/http";
import { getSetting } from "@/lib/server/settings";
import { loadReviews } from "./reviews";
import type { CountryReview, ReviewSummary, SummaryPoint } from "./types";

const DEFAULT_MODEL = "claude-sonnet-5-5";
const FALLBACK_MODELS = new Set(["claude-sonnet-5-5", "claude-opus-5-5", "claude-opus-5", "claude-fable-5-1"]);
const MAX_REVIEWS = 220;
const MAX_CHARS = 600;

type MessagesResponse = {
  content?: { type: string; text?: string }[];
  stop_reason?: string;
  error?: { message?: string };
};

function pickReviews(reviews: CountryReview[]) {
  const low = reviews.filter((r) => r.rating <= 2);
  const mid = reviews.filter((r) => r.rating === 3);
  const high = reviews.filter((r) => r.rating >= 4);
  const take = (list: CountryReview[], n: number) => list.slice(0, n);
  return [...take(low, 120), ...take(mid, 40), ...take(high, 60)].slice(0, MAX_REVIEWS);
}

function formatReview(r: CountryReview) {
  const body = r.content.replace(/\s+/g, " ").trim().slice(0, MAX_CHARS);
  return `<review rating="${r.rating}" version="${r.version}" country="${r.country}">${r.title.replace(/\s+/g, " ")} — ${body}</review>`;
}

function points(value: unknown): SummaryPoint[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is Record<string, unknown> => !!v && typeof v === "object")
    .map((v) => ({
      title: String(v.title ?? "").trim(),
      detail: String(v.detail ?? "").trim(),
      mentions: typeof v.mentions === "number" ? v.mentions : null,
    }))
    .filter((p) => p.title);
}

function parseSummary(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const data = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    return {
      overview: String(data.overview ?? "").trim(),
      complaints: points(data.complaints),
      requests: points(data.requests),
      praise: points(data.praise),
    };
  } catch {
    return null;
  }
}

const SYSTEM = `You analyze App Store customer reviews for an app developer doing App Store Optimization.
Group feedback into recurring themes and be concrete: name the feature, screen or behavior involved.
Respond with a single JSON object and nothing else, using this shape:
{"overview": string (2-3 sentences), "complaints": [{"title": string, "detail": string, "mentions": number}], "requests": [{"title": string, "detail": string, "mentions": number}], "praise": [{"title": string, "detail": string, "mentions": number}]}
Use at most 6 items per list, ordered by how often they come up. "mentions" is your estimate of how many of the provided reviews raise the point. Write in English even when reviews are in other languages.`;

export function aiConfigured() {
  return !!getSetting("ai.anthropicKey");
}

export async function summarizeReviews(trackId: number, scope: string, appName: string): Promise<ReviewSummary> {
  const apiKey = getSetting("ai.anthropicKey");
  if (!apiKey) throw new HttpError(400, "Add an Anthropic API key in Settings to enable AI summaries");
  const model = getSetting("ai.model")?.trim() || DEFAULT_MODEL;
  const { reviews } = await loadReviews(trackId, scope);
  if (!reviews.length) throw new HttpError(404, "No reviews to summarize for this storefront");
  const sample = pickReviews(reviews);
  const key = `reviews:summary:v1:${model}:${scope}:${trackId}:${reviews[0]?.id ?? ""}:${reviews.length}`;
  return cached(key, DAY, async () => {
    const withFallback = FALLBACK_MODELS.has(model);
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        ...(withFallback ? { "anthropic-beta": "server-side-fallback-2026-07-01" } : {}),
      },
      body: JSON.stringify({
        model,
        max_tokens: 16000,
        system: SYSTEM,
        ...(withFallback ? { fallbacks: "default" } : {}),
        messages: [
          {
            role: "user",
            content: `App: ${appName}\nReviews (${sample.length} of ${reviews.length}, most recent first, weighted toward low ratings):\n\n${sample.map(formatReview).join("\n")}\n\nSummarize the main complaints, feature requests and praise as JSON.`,
          },
        ],
      }),
      signal: AbortSignal.timeout(180000),
    });
    const data = (await res.json().catch(() => ({}))) as MessagesResponse;
    if (!res.ok) throw new HttpError(res.status === 401 ? 400 : 502, `Anthropic API: ${data.error?.message ?? `request failed (${res.status})`}`);
    if (data.stop_reason === "refusal") throw new HttpError(502, "The model declined to summarize these reviews");
    const text = (data.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
    const parsed = parseSummary(text);
    if (!parsed) throw new HttpError(502, "Could not parse the AI summary");
    return { ...parsed, reviewCount: sample.length, model, generatedAt: new Date().toISOString() };
  });
}
