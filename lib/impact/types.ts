export type ImpactDays = 7 | 30 | 90;
export type ImpactDemoMode = "never" | "auto" | "only";
export type Confidence = "high" | "medium" | "low";
export type ObservedSource = "posthog" | "sdk" | "demo" | "none";
export type SourceState = "connected" | "missing" | "error" | "demo";
export type PaidRevenueSource = "attributed" | "modelled";

export type ImpactDataSources = {
  observed: ObservedSource;
  posthog: SourceState;
  sdk: SourceState;
  revenue: SourceState;
  appleAds: SourceState;
  errors: string[];
};

export type ImpactCountry = {
  country: string;
  observed: number | null;
  paid: number;
  organic: number | null;
  searchEstimate: number | null;
  explained: number;
  unexplained: number | null;
  browse: number | null;
  alpha: number | null;
  alphaClamped: "min" | "max" | null;
  arpu: number | null;
  arpuSource: "country" | "app" | null;
  revenue: number | null;
  keywordRevenue: number | null;
  keywords: number;
  liveKeywords: number;
};

export type ImpactKeyword = {
  key: string;
  keywordId: number | null;
  term: string;
  country: string;
  position: number | null;
  positionStart: number | null;
  popularity: number | null;
  popularitySource: "apple" | "estimate" | null;
  estDownloads: number;
  estPerDay: number;
  shareOfSearch: number | null;
  estRevenue: number | null;
  paidInstalls: number;
  paidRevenue: number | null;
  paidRevenueSource: PaidRevenueSource | null;
  confidence: Confidence;
  confidenceReasons: string[];
  live: boolean;
  series: number[];
};

export type ImpactTotals = {
  observed: number | null;
  paid: number;
  organic: number | null;
  searchEstimate: number | null;
  explained: number;
  unexplained: number | null;
  browse: number | null;
  revenue: number | null;
  keywordRevenue: number | null;
  paidRevenue: number | null;
};

export type ImpactChartKey = { key: string; label: string; kind: "keyword" | "other" | "browse" | "paid" };

export type ImpactGeo = { country: string; observed: number | null; estDownloads: number; estRevenue: number | null };

export type ImpactResult = {
  demo: boolean;
  notice: string | null;
  calibrated: boolean;
  appId: number;
  country: string;
  days: ImpactDays;
  from: string;
  to: string;
  dates: string[];
  searchShare: number;
  revenueAvailable: boolean;
  totals: ImpactTotals;
  otherCountries: { observed: number; paid: number } | null;
  countries: ImpactCountry[];
  keywords: ImpactKeyword[];
  chart: { keys: ImpactChartKey[]; points: Record<string, number | string>[] };
  geography: ImpactGeo[];
  dataSources: ImpactDataSources;
};
