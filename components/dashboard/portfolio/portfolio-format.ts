import { approxInstalls } from "@/components/trends/trends-format";
import { formatCompact, formatUsd } from "@/lib/client/format";
import type { PortfolioApp, PortfolioMetric, PortfolioValue } from "@/lib/dashboard/portfolio-types";

export const APP_COLORS = ["#3987e5", "#d95926", "#16c89e", "#a66ee0", "#d6a21e", "#2fb5c7", "#e0567a", "#8bbf3f"];

export function appColor(index: number) {
  return APP_COLORS[index % APP_COLORS.length];
}

export const METRICS: { key: PortfolioMetric; label: string; source: "apple" | "posthog" | "revenue" | "estimate"; hint: string; daily: boolean }[] = [
  { key: "downloads", label: "First-time downloads", source: "apple", hint: "First-time downloads per day, reported by Apple", daily: false },
  { key: "firstOpens", label: "First opens", source: "posthog", hint: "First-open events per day, counted by PostHog", daily: false },
  { key: "revenue", label: "Net revenue", source: "revenue", hint: "Revenue after refunds per day, in USD", daily: false },
  { key: "estSearch", label: "Est. search installs", source: "estimate", hint: "Installs per day the rankings model expects from tracked keywords", daily: true },
  { key: "impressions", label: "Impressions", source: "apple", hint: "App Store impressions per day, reported by Apple", daily: false },
];

export function metricValue(key: PortfolioMetric, n: number | null) {
  if (n == null) return "—";
  if (key === "revenue") return formatUsd(n);
  if (key === "estSearch") return approxInstalls(n);
  return formatCompact(n);
}

export function seriesTotal(app: PortfolioApp, key: PortfolioMetric) {
  const values = app.series[key].filter((v): v is number => v != null);
  if (!values.length) return null;
  const sum = values.reduce((s, n) => s + n, 0);
  return key === "estSearch" ? sum / values.length : sum;
}

export function change(v: PortfolioValue) {
  if (v.value == null || v.previous == null || v.previous === 0) return null;
  return (v.value - v.previous) / Math.abs(v.previous);
}

export function appHref(app: PortfolioApp, path = "") {
  return app.id == null ? null : `/apps/${app.id}${path}`;
}
