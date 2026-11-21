export const TRAFFIC_DAYS = [7, 30, 90] as const;
export type TrafficDays = (typeof TRAFFIC_DAYS)[number];

export type TrafficSourceId = "apple" | "posthog" | "revenue";

export type TrafficSourceState = "ok" | "connect" | "setup" | "waiting" | "error";

export type TrafficSource = {
  state: TrafficSourceState;
  demo: boolean;
  message: string | null;
  through: string | null;
};

export type TrafficStepKey = "impressions" | "pageViews" | "downloads" | "firstOpens" | "trials" | "purchases" | "revenue";

export type TrafficStep = {
  key: TrafficStepKey;
  source: TrafficSourceId;
  value: number | null;
  previous: number | null;
};

export type TrafficPoint = {
  date: string;
  downloads: number | null;
  searchDownloads: number | null;
  impressions: number | null;
  firstOpens: number | null;
  estSearch: number | null;
};

export type TrafficReconcile =
  | { kind: "opens"; days: number; from: string; to: string; opens: number; downloads: number }
  | { kind: "search"; days: number; from: string; to: string; estimated: number; apple: number };

export type TrafficCountry = {
  country: string;
  downloads: number | null;
  firstOpens: number | null;
  revenue: number | null;
  estSearch: number | null;
  keywords: number;
  top10: number;
  best: { id: number; term: string; position: number | null } | null;
};

export type TrafficResult = {
  appId: number;
  days: TrafficDays;
  country: string;
  demo: boolean;
  from: string;
  to: string;
  sources: Record<TrafficSourceId, TrafficSource>;
  revenueProviders: string[];
  payersOnly: boolean;
  attribution: boolean;
  rankings: { keywords: number; targets: number; estPerDay: number | null; reach: number | null; top10: number };
  steps: TrafficStep[];
  daily: TrafficPoint[];
  versions: { version: string; date: string }[];
  reconcile: TrafficReconcile[];
  countries: TrafficCountry[];
  territories: string[];
};
