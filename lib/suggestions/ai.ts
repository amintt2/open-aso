import { getCountry } from "@/lib/appstore/countries";
import { normalizeTerm } from "@/lib/aso/scoring";
import { aiAvailable as available, generateJson } from "@/lib/ai/claude";

export function aiAvailable() {
  return available();
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
  if (!aiAvailable()) return [];
  const { data } = await generateJson<{ keywords?: unknown }>({ prompt: prompt(input), schema: SCHEMA, effort: "low" });
  const list = Array.isArray(data.keywords) ? data.keywords : [];
  return [...new Set(list.filter((k): k is string => typeof k === "string").map(normalizeTerm).filter(Boolean))];
}
