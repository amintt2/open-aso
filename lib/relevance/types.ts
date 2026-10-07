export type RelevanceCategory = "core" | "related" | "unrelated" | "brand";

export type RelevanceSource = "jev" | "heuristic";

export type Relevance = {
  relevance: number;
  category: RelevanceCategory;
  languageMatch: boolean;
  source: RelevanceSource;
};

export const RELEVANCE_LABEL: Record<RelevanceCategory, string> = {
  core: "Core",
  related: "Related",
  unrelated: "Unrelated",
  brand: "Brand",
};

export const RELEVANCE_TONE: Record<RelevanceCategory, "green" | "blue" | "neutral" | "amber"> = {
  core: "green",
  related: "blue",
  unrelated: "neutral",
  brand: "amber",
};

export function isRelevant(r: Pick<Relevance, "category" | "languageMatch"> | null | undefined) {
  return !r || ((r.category === "core" || r.category === "related") && r.languageMatch);
}

export type RelevanceStatus = { configured: boolean; model: string };
