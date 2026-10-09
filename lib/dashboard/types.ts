import type { Insight } from "@/lib/insights/types";
import type { CountryOpportunity } from "@/lib/opportunities/types";
import type { RelevanceCategory } from "@/lib/relevance/types";
import type { TrendMover } from "@/lib/trends/types";

export type Period = { current: number; previous: number | null };

export type HomeKpis = {
  apps: number;
  trackedKeywords: number;
  addedThisWeek: number;
  top10: Period | null;
  visibility: Period | null;
  searchInstalls: Period | null;
  installs: (Period & { source: "posthog" | "sdk" }) | null;
  revenue: (Period & { providers: string[] }) | null;
  ads: {
    currency: string;
    spend: Period;
    installs: number;
    roas: number | null;
    cpa: number | null;
  } | null;
  adsError: string | null;
};

export type AppWarnings = {
  unrelated: number;
  wrongLanguage: number;
  stale: number;
  ascNotLinked: boolean;
  detectionNeverRun: boolean;
};

export type DashboardApp = {
  id: number;
  name: string;
  subtitle: string | null;
  iconUrl: string | null;
  primaryCountry: string;
  keywordCount: number;
  countries: string[];
  series: { date: string; visibility: number | null }[];
  visibility: number | null;
  visibilityChange: number | null;
  avgPosition: number | null;
  top10: number;
  top3: number;
  tracked: number;
  bestKeyword: {
    term: string;
    country: string;
    position: number | null;
    installs: number;
  } | null;
  warnings: AppWarnings;
  lastRefreshedAt: string | null;
};

export type AppsResult = { dates: string[]; apps: DashboardApp[] };

export type AppRef = { appId: number; appName: string; iconUrl: string | null };

export type DashboardMover = TrendMover & AppRef;

export type MoversResult = {
  days: number;
  gainers: DashboardMover[];
  losers: DashboardMover[];
};

export type AlertSeverity = "high" | "medium" | "low";

export type DashboardAlert = {
  id: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  href: string;
  app?: AppRef;
};

export type RevenuePoint = { date: string; installs: number; revenue: number };

export type RevenueChart = {
  demo: boolean;
  installsSource: "posthog" | "sdk" | "demo" | null;
  revenueAvailable: boolean;
  points: RevenuePoint[];
};

export type PosthogMode = "live" | "demo" | "unmapped";

export type PosthogScope = {
  mode: PosthogMode;
  notice: string | null;
  apps: AppRef[];
  errors: string[];
};

export type FunnelSnapshot = {
  onboarding: number | null;
  paywall: number | null;
  purchase: number | null;
  start: number;
  toPaywall: number | null;
  toPurchase: number | null;
  overall: number | null;
};

export type PosthogKpis = PosthogScope & {
  newUsersToday: number;
  newUsersYesterday: number;
  newUsers: Period;
  dau: number;
  funnel: FunnelSnapshot | null;
};

export type GeoCountry = {
  country: string;
  newUsers: number;
  previous: number;
  revenue: number | null;
};

export type GeoResult = PosthogScope & {
  days: number;
  total: number;
  previousTotal: number;
  revenueAvailable: boolean;
  countries: GeoCountry[];
};

export type LiveEventRow = {
  id: string;
  timestamp: string;
  event: string;
  canonical: string;
  country: string | null;
  version: string | null;
  app: AppRef | null;
};

export type LiveResult = PosthogScope & {
  fetchedAt: string;
  events: LiveEventRow[];
};

export type Significance =
  | "winner"
  | "loser"
  | "not-significant"
  | "control"
  | "insufficient";

export type ExperimentVariant = {
  variant: string;
  users: number;
  paywallRate: number | null;
  purchaseRate: number | null;
  uplift: number | null;
  pValue: number | null;
  significance: Significance;
};

export type ExperimentResult = {
  flag: string;
  users: number;
  metric: "purchase" | "paywall" | null;
  app: AppRef | null;
  variants: ExperimentVariant[];
  verdict: string;
};

export type ExperimentsResult = PosthogScope & {
  days: number;
  experiments: ExperimentResult[];
};

export type OverviewSummary = {
  app: {
    id: number;
    name: string;
    subtitle: string | null;
    iconUrl: string | null;
    developer: string | null;
    rating: number | null;
    ratingCount: number | null;
    version: string | null;
    versionDate: string | null;
    genre: string | null;
    primaryCountry: string;
    countries: string[];
    keywordCount: number;
    url: string | null;
  };
  country: string;
  visibility: Period | null;
  avgPosition: Period | null;
  top10: Period | null;
  top3: Period | null;
  searchInstalls: Period | null;
  installs: (Period & { source: "posthog" | "sdk" }) | null;
  revenue: Period | null;
};

export type TopKeyword = {
  id: number;
  term: string;
  country: string;
  position: number | null;
  positionChange: number | null;
  popularity: number | null;
  popularitySource: "apple" | "estimate" | null;
  relevance: number | null;
  relevanceCategory: RelevanceCategory | null;
  languageMatch: boolean;
  estInstalls: number;
};

export type ImpactSummary = {
  demo: boolean;
  calibrated: boolean;
  revenueAvailable: boolean;
  days: number;
  keywords: {
    key: string;
    term: string;
    country: string;
    position: number | null;
    estDownloads: number;
    estRevenue: number | null;
  }[];
  totalExplained: number;
};

export type InsightsSummary = {
  country: string;
  total: number;
  insights: Insight[];
};

export type AdsSummary =
  | { state: "disconnected" }
  | { state: "error"; message: string }
  | { state: "no-campaigns"; demo: boolean }
  | {
      state: "ok";
      demo: boolean;
      currency: string;
      spend: number;
      installs: number;
      cpa: number | null;
      roas: number | null;
      campaigns: number;
      previousSpend: number | null;
    };

export type ReviewsSummary = {
  country: string;
  storeRating: number | null;
  storeCount: number | null;
  recentAverage: number | null;
  recentCount: number;
  latest: {
    id: string;
    author: string;
    title: string;
    content: string;
    rating: number;
    version: string;
    updated: string;
  }[];
};

export type OpportunitiesSummary = {
  term: string | null;
  scannedAt: string | null;
  top: CountryOpportunity[];
};
