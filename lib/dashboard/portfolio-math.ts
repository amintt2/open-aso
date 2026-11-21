import type { TrafficSourceId, TrafficStepKey } from "@/lib/traffic/types";
import type { PortfolioApp, PortfolioCountry, PortfolioStep } from "./portfolio-types";

const COUNTRY_LIMIT = 15;

export const STEP_ORDER: { key: TrafficStepKey; source: TrafficSourceId }[] = [
  { key: "impressions", source: "apple" },
  { key: "pageViews", source: "apple" },
  { key: "downloads", source: "apple" },
  { key: "firstOpens", source: "posthog" },
  { key: "trials", source: "revenue" },
  { key: "purchases", source: "revenue" },
  { key: "revenue", source: "revenue" },
];

export function sumSteps(apps: PortfolioApp[]): PortfolioStep[] {
  return STEP_ORDER.map(({ key, source }, i) => {
    const have = apps.filter((a) => a.steps[key].value != null);
    const withPrevious = have.filter((a) => a.steps[key].previous != null);
    const before = key === "revenue" ? "downloads" : i > 0 ? STEP_ORDER[i - 1].key : null;
    const both = before ? apps.filter((a) => a.steps[key].value != null && a.steps[before].value != null) : [];
    const denominator = before ? both.reduce((s, a) => s + (a.steps[before].value ?? 0), 0) : 0;
    return {
      key,
      source,
      value: have.length ? Math.round(have.reduce((s, a) => s + (a.steps[key].value ?? 0), 0) * 100) / 100 : null,
      previous: withPrevious.length && withPrevious.length === have.length ? withPrevious.reduce((s, a) => s + (a.steps[key].previous ?? 0), 0) : null,
      connected: have.length,
      rate: before && denominator > 0 ? both.reduce((s, a) => s + (a.steps[key].value ?? 0), 0) / denominator : null,
    };
  });
}

export function splitCountries(rows: PortfolioCountry[]) {
  const sorted = rows.filter((r) => r.total > 0).sort((a, b) => b.total - a.total);
  const rest = sorted.slice(COUNTRY_LIMIT);
  const other: PortfolioCountry | null = rest.length
    ? { country: "other", total: rest.reduce((s, r) => s + r.total, 0), byApp: rest[0].byApp.map((_, i) => rest.reduce((s, r) => s + r.byApp[i], 0)) }
    : null;
  return { countries: sorted.slice(0, COUNTRY_LIMIT), otherCountries: other };
}
