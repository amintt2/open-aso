export const METADATA_LIMITS = {
  name: 30,
  subtitle: 30,
  keywords: 100,
  promotionalText: 170,
  description: 4000,
  whatsNew: 4000,
} as const;

export const INFO_FIELDS = ["name", "subtitle", "privacyPolicyUrl", "privacyChoicesUrl"] as const;
export const VERSION_FIELDS = ["keywords", "description", "promotionalText", "whatsNew", "marketingUrl", "supportUrl"] as const;

export type InfoField = (typeof INFO_FIELDS)[number];
export type VersionField = (typeof VERSION_FIELDS)[number];
export type MetadataField = InfoField | VersionField;
export type MetadataPatch = Partial<Record<MetadataField, string>>;

export type LocaleMetadata = {
  locale: string;
  appInfoLocalizationId: string | null;
  versionLocalizationId: string | null;
} & Record<MetadataField, string | null>;

export type AscAppInfoSummary = { id: string; state: string; editable: boolean };

export type AscVersionSummary = {
  id: string;
  versionString: string;
  state: string;
  platform: string;
  createdDate: string | null;
  editable: boolean;
};

export type AppMetadata = {
  ascAppId: string;
  appName: string;
  bundleId: string;
  primaryLocale: string;
  appInfo: AscAppInfoSummary | null;
  version: AscVersionSummary | null;
  liveVersion: AscVersionSummary | null;
  localizations: LocaleMetadata[];
  fetchedAt: string;
};

export type AscStatus = {
  configured: boolean;
  connected: boolean;
  issuerId: string | null;
  keyId: string | null;
  error: string | null;
  sampleApp: string | null;
};

export type AscAppOption = { id: string; name: string; bundleId: string; sku: string; primaryLocale: string };

export type ScreenshotItem = { id: string; fileName: string | null; url: string | null; width: number | null; height: number | null; state: string | null };
export type ScreenshotSet = { id: string; displayType: string; screenshots: ScreenshotItem[] };

export type ProductKind = "subscription" | "iap";

export type AscProduct = {
  kind: ProductKind;
  id: string;
  name: string;
  productId: string;
  state: string | null;
  type: string | null;
  period: string | null;
  groupId: string | null;
  groupName: string | null;
};

export type TerritoryPrice = {
  priceId: string | null;
  territory: string;
  currency: string | null;
  customerPrice: number | null;
  proceeds: number | null;
  pricePointId: string | null;
  startDate: string | null;
  endDate: string | null;
  preserved: boolean;
  manual: boolean;
};

export type ProductPrices = {
  kind: ProductKind;
  productId: string;
  baseTerritory: string | null;
  current: TerritoryPrice[];
  upcoming: TerritoryPrice[];
  fetchedAt: string;
};

export type PricingStrategy = "ppp" | "equalized";

export type PlanRow = {
  territory: string;
  currency: string | null;
  current: number | null;
  currentPricePointId: string | null;
  target: number | null;
  proposed: number | null;
  proposedPricePointId: string | null;
  ratio: number | null;
  deltaPct: number | null;
  unmatched: string | null;
  alreadyScheduled: boolean;
};

export type PricingPlan = {
  basePricePointId: string;
  baseUsd: number;
  strategy: PricingStrategy;
  rows: PlanRow[];
};

export type ScheduleRow = { territory: string; pricePointId: string; increase: boolean };

export type ScheduleResult = { territory: string; ok: boolean; skipped?: boolean; error?: string };
