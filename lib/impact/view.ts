import type { ModelCountry, ModelOutput } from "./model";
import type { ImpactChartKey, ImpactGeo, ImpactKeyword, ImpactTotals } from "./types";

export const TOP_CHART_KEYWORDS = 6;

const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);

function nullableSum(values: readonly (number | null)[]) {
  const present = values.filter((v): v is number => v != null);
  return present.length ? sum(present) : null;
}

export function scopeOf(model: ModelOutput, country: string) {
  const all = country === "all";
  return {
    countries: all ? model.countries : model.countries.filter((c) => c.country === country),
    keywords: all ? model.keywords : model.keywords.filter((k) => k.country === country),
  };
}

export function totalsOf(countries: readonly ModelCountry[], keywords: readonly ImpactKeyword[]): ImpactTotals {
  return {
    observed: nullableSum(countries.map((c) => c.observed)),
    paid: sum(countries.map((c) => c.paid)),
    organic: nullableSum(countries.map((c) => c.organic)),
    searchEstimate: nullableSum(countries.map((c) => c.searchEstimate)),
    explained: sum(countries.map((c) => c.explained)),
    unexplained: nullableSum(countries.map((c) => c.unexplained)),
    browse: nullableSum(countries.map((c) => c.browse)),
    revenue: nullableSum(countries.map((c) => c.revenue)),
    keywordRevenue: nullableSum(countries.map((c) => c.keywordRevenue)),
    paidRevenue: nullableSum(keywords.map((k) => k.paidRevenue)),
  };
}

function label(k: ImpactKeyword, multiCountry: boolean) {
  return multiCountry ? `${k.term} · ${k.country.toUpperCase()}` : k.term;
}

export function chartOf(dates: readonly string[], countries: readonly ModelCountry[], keywords: readonly ImpactKeyword[]) {
  const multiCountry = new Set(keywords.map((k) => k.country)).size > 1;
  const top = keywords.filter((k) => k.estDownloads > 0).slice(0, TOP_CHART_KEYWORDS);
  const topKeys = new Set(top.map((k) => k.key));
  const rest = keywords.filter((k) => !topKeys.has(k.key));
  const calibrated = countries.some((c) => c.daily.other != null);
  const paidTotal = sum(countries.map((c) => c.paid));
  const keys: ImpactChartKey[] = [
    ...top.map((k, i) => ({ key: `k${i}`, label: label(k, multiCountry), kind: "keyword" as const })),
    { key: "other", label: calibrated ? "Other searches / untracked keywords" : "Other tracked keywords", kind: "other" },
    ...(calibrated ? [{ key: "browse", label: "Browse & referral", kind: "browse" as const }] : []),
    ...(paidTotal > 0 ? [{ key: "paid", label: "Apple Ads (paid)", kind: "paid" as const }] : []),
  ];
  const points = dates.map((date, i) => {
    const point: Record<string, number | string> = { date };
    top.forEach((k, j) => (point[`k${j}`] = k.series[i] ?? 0));
    point.other = sum(rest.map((k) => k.series[i] ?? 0)) + sum(countries.map((c) => c.daily.other?.[i] ?? 0));
    if (calibrated) point.browse = sum(countries.map((c) => c.daily.browse?.[i] ?? 0));
    if (paidTotal > 0) point.paid = sum(countries.map((c) => c.daily.paid[i] ?? 0));
    return point;
  });
  return { keys, points };
}

export function geographyOf(countries: readonly ModelCountry[]): ImpactGeo[] {
  return countries.map((c) => ({ country: c.country, observed: c.observed, estDownloads: c.explained, estRevenue: c.keywordRevenue }));
}

export function publicCountry(c: ModelCountry) {
  const { daily, ...rest } = c;
  void daily;
  return rest;
}
