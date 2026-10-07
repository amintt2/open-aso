export type PosthogRegion = "us" | "eu" | "custom";

export type PosthogStatus = {
  configured: boolean;
  region: PosthogRegion | null;
  host: string | null;
  projectId: string | null;
  keyHint: string | null;
  mappedApps: number;
};

export type PosthogConnectionCheck = { ok: true; eventsLast24h: number; checkedAt: string };

export const EVENT_ROLES = ["install", "open", "onboarding_start", "onboarding_complete", "paywall_view", "purchase_start", "purchase_success", "purchase_cancel"] as const;

export type EventRole = (typeof EVENT_ROLES)[number];

export const ROLE_LABELS: Record<EventRole, string> = {
  install: "First open",
  open: "App open",
  onboarding_start: "Onboarding started",
  onboarding_complete: "Onboarding completed",
  paywall_view: "Paywall viewed",
  purchase_start: "Purchase started",
  purchase_success: "Purchase success",
  purchase_cancel: "Purchase cancelled",
};

export type RoleMap = Record<EventRole, string[]>;

export type RoleSource = "auto" | "override";

export type RoleResolution = Record<EventRole, { events: string[]; source: RoleSource }>;

export type PosthogApp = { id: number | null; name: string; bundleId: string | null; prefix: string | null; demoSlug: string | null };

export type PosthogMeta = {
  demo: boolean;
  notice: string | null;
  app: PosthogApp;
  days: number;
  from: string;
  to: string;
  fetchedAt: string;
  cached: boolean;
  roles: RoleMap;
};

export type DiscoveredBundle = { bundleId: string; appName: string | null; events: number; users: number; lastSeen: string | null; prefix: string | null };
export type DiscoveredPrefix = { prefix: string; events: number; users: number; lastSeen: string | null; bundleId: string | null; appName: string | null };

export type AppMapping = { appId: number; bundleId: string | null; prefix: string | null; auto: boolean; updatedAt: string };

export type MappedTrackedApp = {
  id: number;
  name: string;
  iconUrl: string | null;
  bundleId: string | null;
  mapping: AppMapping | null;
  suggestion: { bundleId: string | null; prefix: string | null } | null;
};

export type DiscoveryResult = {
  bundles: DiscoveredBundle[];
  prefixes: DiscoveredPrefix[];
  apps: MappedTrackedApp[];
  fetchedAt: string;
  cached: boolean;
};

export type CatalogEvent = { event: string; canonical: string; count: number; users: number; role: EventRole | null };

export type EventCatalogResult = {
  app: PosthogApp;
  events: CatalogEvent[];
  roles: RoleResolution;
  fetchedAt: string;
  cached: boolean;
};

export type DailyProductPoint = { date: string; newUsers: number; dau: number; events: number };

export type TopEventRow = { event: string; canonical: string; role: EventRole | null; count: number; users: number };

export type PosthogOverviewResult = PosthogMeta & {
  totals: { newUsers: number; previousNewUsers: number; activeUsers: number; dauAverage: number; wau: number; events: number; previousEvents: number };
  series: DailyProductPoint[];
  topEvents: TopEventRow[];
};

export type FunnelStep = { role: EventRole; label: string; events: string[]; users: number; fromStart: number | null; fromPrevious: number | null; dropOff: number };

export type PosthogFunnelResult = PosthogMeta & {
  steps: FunnelStep[];
  cancel: { started: number; cancelled: number; rate: number | null };
  missing: EventRole[];
};

export type ProductRetentionCohort = { cohort: string; users: number; d1: number | null; d7: number | null; d30: number | null; eligible: { d1: number; d7: number; d30: number } };

export type PosthogRetentionResult = PosthogMeta & {
  granularity: "day" | "week";
  activity: "open" | "any";
  cohorts: ProductRetentionCohort[];
  average: { d1: number | null; d7: number | null; d30: number | null };
  missing: EventRole[];
};

export type ProductCountryRow = { country: string; newUsers: number; activeUsers: number };
export type ProductCityRow = { city: string; country: string | null; newUsers: number; activeUsers: number };

export type PosthogGeographyResult = PosthogMeta & { countries: ProductCountryRow[]; cities: ProductCityRow[] };

export type VersionRow = { version: string; users: number; newUsers: number; events: number; firstSeen: string | null; lastSeen: string | null; releasedAt: string | null };

export type PosthogVersionsResult = PosthogMeta & { versions: VersionRow[] };

export type VariantRow = { variant: string; users: number; paywallUsers: number; purchaseUsers: number; paywallRate: number | null; purchaseRate: number | null };
export type ExperimentRow = { flag: string; users: number; variants: VariantRow[] };

export type PosthogExperimentsResult = PosthogMeta & { experiments: ExperimentRow[] };

export type LiveEvent = {
  timestamp: string;
  event: string;
  canonical: string;
  role: EventRole | null;
  distinctId: string;
  lib: string | null;
  country: string | null;
  version: string | null;
};

export type PosthogEventsResult = PosthogMeta & { events: LiveEvent[] };

export type NewUsersPoint = { date: string; newUsers: number };

export type PosthogNewUsersResult = PosthogMeta & { country: string | null; series: NewUsersPoint[]; total: number; previousTotal: number };

export type PosthogView = "overview" | "funnel" | "retention" | "geography" | "versions" | "experiments" | "events" | "newusers";
