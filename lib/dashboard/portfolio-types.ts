import type { TrafficDays, TrafficSourceId, TrafficSourceState, TrafficStepKey } from "@/lib/traffic/types";

export const PORTFOLIO_METRICS = ["downloads", "firstOpens", "revenue", "estSearch", "impressions"] as const;
export type PortfolioMetric = (typeof PORTFOLIO_METRICS)[number];

export type PortfolioValue = { value: number | null; previous: number | null };

export type PortfolioApp = {
  key: string;
  id: number | null;
  name: string;
  iconUrl: string | null;
  sources: Record<TrafficSourceId, TrafficSourceState>;
  steps: Record<TrafficStepKey, PortfolioValue>;
  series: Record<PortfolioMetric, (number | null)[]>;
  conversion: PortfolioValue;
  keywords: number;
  top10: number;
  estPerDay: number | null;
  reach: number | null;
  versions: { version: string; date: string }[];
};

export type PortfolioStep = PortfolioValue & {
  key: TrafficStepKey;
  source: TrafficSourceId;
  connected: number;
  rate: number | null;
};

export type PortfolioCountry = { country: string; total: number; byApp: number[] };

export type PortfolioKeyword = {
  id: number | null;
  app: string;
  term: string;
  country: string;
  position: number | null;
  popularity: number | null;
  estInstalls: number;
};

export type PortfolioResult = {
  days: TrafficDays;
  demo: boolean;
  from: string;
  to: string;
  dates: string[];
  appleThrough: string | null;
  revenueProviders: string[];
  apps: PortfolioApp[];
  steps: PortfolioStep[];
  countries: PortfolioCountry[];
  otherCountries: PortfolioCountry | null;
  keywords: PortfolioKeyword[];
};
