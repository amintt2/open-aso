export type ReportFamily = "engagement" | "downloads" | "purchases";
export type AccessType = "ONGOING" | "ONE_TIME_SNAPSHOT";

export type SourceType = "search" | "browse" | "app_referrer" | "web_referrer" | "app_clip" | "notification" | "institutional" | "in_store" | "unavailable" | "other";

export type MetricKey = "impressions" | "impressionsUnique" | "pageViews" | "pageViewsUnique" | "firstDownloads" | "redownloads" | "updates" | "purchases" | "proceeds" | "sales";

export type Metrics = Record<MetricKey, number>;

export type DailyRow = Metrics & { date: string; territory: string; source: SourceType };

export type StoreStatus = "not_connected" | "not_linked" | "not_requested" | "waiting" | "error" | "ok";

export type StoreDays = 7 | 30 | 90 | 180;

export type Period = { current: number; previous: number | null };

export type StorePoint = {
  date: string;
  impressions: number;
  impressionsUnique: number;
  pageViews: number;
  pageViewsUnique: number;
  firstDownloads: number;
  redownloads: number;
  updates: number;
  proceeds: number;
  conversion: number | null;
  pageViewConversion: number | null;
};

export type SourceBreakdown = {
  source: SourceType;
  impressions: number;
  pageViews: number;
  firstDownloads: number;
  redownloads: number;
  previousFirstDownloads: number | null;
  conversion: number | null;
  share: number | null;
};

export type TerritoryBreakdown = {
  territory: string;
  impressions: number;
  pageViews: number;
  firstDownloads: number;
  redownloads: number;
  previousFirstDownloads: number | null;
  conversion: number | null;
  proceeds: number;
};

export type SyncLogEntry = {
  at: string;
  trigger: "scheduled" | "manual" | "forced";
  outcome: "new-data" | "no-new-data" | "up-to-date" | "waiting" | "error";
  calls: number;
  downloads: number;
  instances: number;
  rows: number;
  message?: string;
};

export type SyncInfo = {
  demo: boolean;
  requestedAt: string | null;
  accessTypes: AccessType[];
  snapshot: "none" | "pending" | "done";
  lastCheckAt: string | null;
  nextCheckAt: string | null;
  lastProcessingDate: string | null;
  dataThrough: string | null;
  upToDate: boolean;
  publishMinuteUtc: number | null;
  apiCallsToday: number;
  apiCallsTotal: number;
  workspaceCallsToday: number;
  lastError: string | null;
  log: SyncLogEntry[];
};

export type StoreTotals = Record<"impressions" | "impressionsUnique" | "pageViews" | "pageViewsUnique" | "firstDownloads" | "redownloads" | "updates" | "proceeds" | "conversion" | "pageViewConversion", Period>;

export type StoreAnalyticsResult = {
  appId: number;
  status: StoreStatus;
  demo: boolean;
  notice: string | null;
  message: string | null;
  country: string;
  days: StoreDays;
  from: string | null;
  to: string | null;
  dataThrough: string | null;
  totals: StoreTotals | null;
  daily: StorePoint[];
  sources: SourceBreakdown[];
  sourceDaily: Record<string, number | string>[];
  territories: TerritoryBreakdown[];
  availableTerritories: string[];
  sync: SyncInfo;
};

export type StoreSummary = {
  state: "ok" | "not_connected" | "no_data";
  demo: boolean;
  dataThrough: string | null;
  apps: number;
  impressions: Period | null;
  pageViews: Period | null;
  firstDownloads: Period | null;
  conversion: Period | null;
};

export type SyncResult = {
  outcome: SyncLogEntry["outcome"];
  calls: number;
  instances: number;
  rows: number;
  dataThrough: string | null;
  nextCheckAt: string | null;
  message: string | null;
};
