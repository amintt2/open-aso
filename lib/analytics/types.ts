export type AnalyticsQuery = {
  appId?: number | null;
  days?: number;
  includeSandbox?: boolean;
  demo?: "auto" | "never" | "only";
};

export type AnalyticsMeta = { demo: boolean; notice: string | null; from: string; to: string; days: number };

export type OverviewTotals = {
  installs: number;
  trials: number;
  purchases: number;
  grossRevenue: number;
  refunds: number;
  netRevenue: number;
  payingUsers: number;
  trialConversion: number | null;
};

export type OverviewPoint = {
  date: string;
  installs: number;
  trials: number;
  purchases: number;
  grossRevenue: number;
  refunds: number;
  netRevenue: number;
};

export type OverviewResult = AnalyticsMeta & { totals: OverviewTotals; previous: OverviewTotals; series: OverviewPoint[] };

export type SourceRow = {
  source: "apple_ads" | "organic";
  installs: number;
  trials: number;
  payers: number;
  revenue: number;
  trialRate: number | null;
  conversion: number | null;
  revenuePerInstall: number | null;
};

export type SourcesResult = AnalyticsMeta & {
  sources: SourceRow[];
  unattributedRevenue: number;
  daily: { date: string; apple_ads: number; organic: number }[];
  campaigns: { campaignId: string; installs: number; trials: number; revenue: number; spend: number; roas: number | null }[];
};

export type CountryRow = { country: string; installs: number; trials: number; payers: number; revenue: number; revenuePerInstall: number | null };
export type CityRow = { city: string; country: string | null; installs: number; revenue: number };
export type GeographyResult = AnalyticsMeta & { countries: CountryRow[]; cities: CityRow[] };

export type RetentionCohort = {
  cohort: string;
  installs: number;
  d1: number | null;
  d7: number | null;
  d30: number | null;
  eligible: { d1: number; d7: number; d30: number };
};

export type RetentionResult = AnalyticsMeta & {
  granularity: "day" | "week";
  cohorts: RetentionCohort[];
  average: { d1: number | null; d7: number | null; d30: number | null };
  sessionDays: number;
};

export type KeywordRoasRow = {
  keywordId: string;
  keyword: string | null;
  campaignId: string | null;
  currency: string | null;
  spend: number;
  impressions: number;
  taps: number;
  adsInstalls: number;
  installs: number;
  trials: number;
  payers: number;
  revenue: number;
  cpi: number | null;
  trialRate: number | null;
  roas: number | null;
};

export type KeywordRoasResult = AnalyticsMeta & {
  keywords: KeywordRoasRow[];
  totals: { spend: number; installs: number; adsInstalls: number; trials: number; revenue: number; cpi: number | null; trialRate: number | null; roas: number | null };
  currency: string;
};

export type KeywordTrendPoint = {
  date: string;
  spend: number;
  taps: number;
  adsInstalls: number;
  installs: number;
  trials: number;
  revenue: number;
  cumulativeRoas: number | null;
};

export type KeywordTrendResult = AnalyticsMeta & { keywordId: string; keyword: string | null; series: KeywordTrendPoint[] };
