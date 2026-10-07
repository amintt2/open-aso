import { cached, DAY } from "@/lib/server/cache";
import { HttpError } from "@/lib/server/http";
import { aiAvailable, aiModel, AiError, generateJson } from "@/lib/ai/claude";
import { loadReviews } from "./reviews";
import type { CountryReview, ReviewSummary, SummaryPoint } from "./types";

const MAX_REVIEWS = 220;
const MAX_CHARS = 600;

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

const SYSTEM = `You analyze App Store customer reviews for an app developer doing App Store Optimization.
Group feedback into recurring themes and be concrete: name the feature, screen or behavior involved.
The overview is 2-3 sentences. Use at most 6 items per list, ordered by how often they come up. "mentions" is your estimate of how many of the provided reviews raise the point. Write in English even when reviews are in other languages.`;

const SCHEMA = {
  type: "object",
  properties: {
    overview: { type: "string" },
    complaints: { type: "array", items: { $ref: "#/$defs/point" } },
    requests: { type: "array", items: { $ref: "#/$defs/point" } },
    praise: { type: "array", items: { $ref: "#/$defs/point" } },
  },
  required: ["overview", "complaints", "requests", "praise"],
  additionalProperties: false,
  $defs: {
    point: {
      type: "object",
      properties: { title: { type: "string" }, detail: { type: "string" }, mentions: { type: "integer" } },
      required: ["title", "detail", "mentions"],
      additionalProperties: false,
    },
  },
};

export function aiConfigured() {
  return aiAvailable();
}

export async function summarizeReviews(trackId: number, scope: string, appName: string): Promise<ReviewSummary> {
  if (!aiAvailable()) throw new HttpError(400, "Add an Anthropic API key in Settings to enable AI summaries");
  const model = aiModel();
  const { reviews } = await loadReviews(trackId, scope);
  if (!reviews.length) throw new HttpError(404, "No reviews to summarize for this storefront");
  const sample = pickReviews(reviews);
  const key = `reviews:summary:v2:${model}:${scope}:${trackId}:${reviews[0]?.id ?? ""}:${reviews.length}`;
  return cached(key, DAY, async () => {
    try {
      const { data, model: used } = await generateJson<Record<string, unknown>>({
        system: SYSTEM,
        schema: SCHEMA,
        effort: "medium",
        prompt: `App: ${appName}\nReviews (${sample.length} of ${reviews.length}, most recent first, weighted toward low ratings):\n\n${sample.map(formatReview).join("\n")}\n\nSummarize the main complaints, feature requests and praise.`,
      });
      return {
        overview: String(data.overview ?? "").trim(),
        complaints: points(data.complaints),
        requests: points(data.requests),
        praise: points(data.praise),
        reviewCount: sample.length,
        model: used,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof AiError) throw new HttpError(error.status, error.message);
      throw error;
    }
  });
}
