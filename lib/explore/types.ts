import type { StoreApp } from "@/lib/appstore/itunes";

export type KeywordSource = "title" | "subtitle" | "description" | "hint" | "genre";

export type RankingKeyword = {
  term: string;
  position: number;
  popularity: number | null;
  resultsCount: number;
  source: KeywordSource;
};

export type CountryPresence = {
  code: string;
  available: boolean;
  rating: number | null;
  ratingCount: number | null;
  price: number | null;
  currency: string | null;
  formattedPrice: string | null;
  version: string | null;
};

export type ExploreAppDetail = {
  app: StoreApp;
  country: string;
  downloadsEst: number;
  revenueEst: number;
  trackedAppId: number | null;
};

export type ChartKind = "free" | "paid";

export type ChartEntry = {
  rank: number;
  trackId: number;
  name: string;
  developer: string;
  iconUrl: string;
  releaseDate: string;
  url: string;
};

export type SimilarApps = {
  similar: StoreApp[];
  developer: StoreApp[];
};
