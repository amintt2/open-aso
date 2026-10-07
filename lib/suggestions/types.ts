import type { TargetingLabel } from "@/lib/aso/scoring";

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
};

export type SuggestionsResult = {
  appId: number;
  country: string;
  generatedAt: string;
  usedAi: boolean;
  aiError?: string;
  candidatesConsidered: number;
  suggestions: Suggestion[];
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
