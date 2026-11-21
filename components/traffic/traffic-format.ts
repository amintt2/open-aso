import type { KpiSource } from "@/components/analytics/parts";
import { formatCompact, formatUsd } from "@/lib/client/format";
import type { TrafficResult, TrafficSourceId, TrafficStepKey } from "@/lib/traffic/types";

export const STEP_META: Record<TrafficStepKey, { label: string; hint: string; from: string }> = {
  impressions: { label: "Impressions", hint: "Times the app icon was shown on the App Store: search results, charts, Today and the product page.", from: "" },
  pageViews: { label: "Page views", hint: "Times the product page was opened.", from: "of impressions" },
  downloads: { label: "First-time downloads", hint: "People who downloaded the app for the first time. The reference number for new installs.", from: "of page views" },
  firstOpens: { label: "First opens", hint: "Devices that sent the first-open event to PostHog. Includes TestFlight and App Review devices, so it can run above Apple's downloads.", from: "of downloads" },
  trials: { label: "Trials", hint: "Free trials started, reported by your revenue provider.", from: "of first opens" },
  purchases: { label: "Purchases", hint: "New paid purchases and trial conversions, reported by your revenue provider.", from: "of trials" },
  revenue: { label: "Net revenue", hint: "Revenue after refunds, in USD, reported by your revenue provider.", from: "per download" },
};

export const SOURCE_KPI: Record<TrafficSourceId, KpiSource> = { apple: "apple", posthog: "posthog", revenue: "revenue" };

export const SOURCE_NAME: Record<TrafficSourceId, string> = { apple: "App Store Connect", posthog: "PostHog", revenue: "RevenueCat" };

const PROVIDERS: Record<string, string> = { revenuecat: "RevenueCat", superwall: "Superwall" };

export function revenueLabel(providers: string[]) {
  const names = providers.map((p) => PROVIDERS[p]).filter(Boolean);
  return names.length ? names.join(" + ") : "RevenueCat";
}

export function stepValue(key: TrafficStepKey, value: number | null) {
  if (value == null) return "—";
  return key === "revenue" ? formatUsd(value) : formatCompact(value);
}

export function connectText(source: TrafficSourceId, state: TrafficResult["sources"][TrafficSourceId]["state"]) {
  if (state === "connect") return source === "revenue" ? "Connect RevenueCat" : `Connect ${SOURCE_NAME[source]}`;
  if (state === "setup") return source === "apple" ? "Link this app" : "Map this app";
  if (state === "waiting") return "Waiting for Apple";
  return "Connection error";
}

export const SERIES_COLOR = {
  downloads: "#3987e5",
  firstOpens: "#d95926",
  estSearch: "#16c89e",
  searchDownloads: "#7cc4ff",
  impressions: "#7f7f7f",
} as const;
