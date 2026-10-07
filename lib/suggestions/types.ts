import type { TargetingLabel } from "@/lib/aso/scoring";
import type { RelevanceCategory, RelevanceSource } from "@/lib/relevance/types";

export type SuggestionSource = "hints" | "top-apps" | "metadata" | "competitors" | "combo" | "ai";

export const SOURCE_LABEL: Record<SuggestionSource, string> = {
  hints: "Search hints",
  "top-apps": "Top apps",
  metadata: "Your listing",
  competitors: "Competitors",
  combo: "Combination",
  ai: "AI",
};

export type Suggestion = {
  term: string;
  sources: SuggestionSource[];
  popularity: number;
  difficulty: number;
  opportunity: number;
  label: TargetingLabel;
  position: number | null;
  downloadsEst: number;
  monthlySearches: number;
  resultsCount: number;
  relevance?: number;
  category?: RelevanceCategory;
  relevanceSource?: RelevanceSource;
  score?: number;
};

export type FilteredSuggestion = {
  term: string;
  sources: SuggestionSource[];
  relevance: number;
  category: RelevanceCategory;
  languageMatch: boolean;
  relevanceSource: RelevanceSource;
};

export const RELEVANCE_EXPONENT = 1;

export function combinedScore(relevance: number | undefined, opportunity: number) {
  if (relevance == null) return opportunity;
  return Math.round(opportunity * Math.pow(Math.max(0, Math.min(100, relevance)) / 100, RELEVANCE_EXPONENT));
}

export type SuggestionsResult = {
  appId: number;
  country: string;
  generatedAt: string;
  usedAi: boolean;
  aiError?: string;
  candidatesConsidered: number;
  suggestions: Suggestion[];
  judged?: number;
  kept?: number;
  relevanceSource?: RelevanceSource | "mixed";
  relevanceError?: string;
  filtered?: FilteredSuggestion[];
};

export type JobView<T> = {
  id: string;
  kind: string;
  status: "running" | "done" | "error";
  stage: string;
  done: number;
  total: number;
  result?: T;
  partial?: unknown;
  error?: string;
  startedAt: string;
  finishedAt?: string;
};

export type SuggestionsOverview = {
  last: SuggestionsResult | null;
  running: JobView<SuggestionsResult> | null;
  aiAvailable: boolean;
  trackedCount: number;
};
