import type { RelevanceCategory } from "@/lib/relevance/types";

export const TREND_DAYS = [7, 30, 90, 365] as const;
export type TrendDays = (typeof TREND_DAYS)[number];

export const UNRANKED = 201;

export const EXCLUDED_CATEGORIES: readonly RelevanceCategory[] = ["unrelated", "brand"];

export type RankBuckets = { top3: number; top10: number; top50: number; top200: number; unranked: number };

export type TrendPoint = RankBuckets & {
  date: string;
  tracked: number;
  installs: number;
  visibility: number | null;
  avgPosition: number | null;
  top10Share: number | null;
};

export type TrendKpis = {
  date: string;
  visibility: number | null;
  installs: number;
  avgPosition: number | null;
  top10: number;
  top3: number;
  tracked: number;
};

export type TrendKeyword = {
  id: number;
  term: string;
  country: string;
  popularitySource: "apple" | "estimate" | null;
  relevanceCategory: RelevanceCategory | null;
  since: number | null;
  position: (number | null)[];
  popularity: (number | null)[];
  difficulty: (number | null)[];
};

export type TrendMover = {
  id: number;
  term: string;
  country: string;
  startPosition: number | null;
  endPosition: number | null;
  positionChange: number;
  startPopularity: number | null;
  endPopularity: number | null;
  popularityChange: number | null;
  startDifficulty: number | null;
  endDifficulty: number | null;
  difficultyChange: number | null;
};

export type TrendMovers = {
  gainers: TrendMover[];
  losers: TrendMover[];
  popularity: TrendMover[];
  difficulty: TrendMover[];
};

export type TrendCountry = {
  country: string;
  keywords: number;
  visibility: number | null;
  visibilityStart: number | null;
  installs: number;
  installsStart: number;
};

export type TrendVersion = { version: string; date: string; releasedAt: string };

export type TrendsResult = {
  appId: number;
  country: string;
  days: TrendDays;
  from: string;
  to: string;
  dates: string[];
  includeAll: boolean;
  excluded: number;
  historyDays: number;
  baselineIndex: number | null;
  points: TrendPoint[];
  kpis: { start: TrendKpis | null; end: TrendKpis | null };
  countries: TrendCountry[];
  keywords: TrendKeyword[];
  movers: TrendMovers;
  versions: TrendVersion[];
};
