import { COUNTRY_BY_CODE } from "@/lib/appstore/countries";
import { formatCompact } from "@/lib/client/format";
import type { RankBuckets, TrendKeyword } from "@/lib/trends/types";

export const LINE_COLORS = ["#3987e5", "#199e70", "#d95926", "#a66ee0", "#d6a21e", "#2fb5c7", "#e0567a", "#8bbf3f"];

export const VISIBILITY_COLOR = "#16c89e";

export const BUCKETS: { key: keyof RankBuckets; label: string; color: string }[] = [
  { key: "top3", label: "Top 3", color: "#7cc4ff" },
  { key: "top10", label: "4–10", color: "#3987e5" },
  { key: "top50", label: "11–50", color: "#2c639f" },
  { key: "top200", label: "51–200", color: "#24405f" },
  { key: "unranked", label: "Not ranked", color: "#3a3a3a" },
];

export const UNRANKED_LABEL = "200+";

export function formatPosition(position: number | null | undefined) {
  return position == null ? UNRANKED_LABEL : `#${position}`;
}

export function formatInstalls(n: number | null | undefined) {
  if (n == null) return "—";
  if (n > 0 && n < 0.05) return "<0.1";
  if (n < 10) return (Math.round(n * 10) / 10).toString();
  return formatCompact(Math.round(n));
}

export function flagOf(code: string) {
  return COUNTRY_BY_CODE.get(code)?.flag ?? code.toUpperCase();
}

export function countryName(code: string) {
  return COUNTRY_BY_CODE.get(code)?.name ?? code.toUpperCase();
}

export function keywordLabel(k: Pick<TrendKeyword, "term" | "country">, withCountry: boolean) {
  return withCountry ? `${k.term} · ${k.country.toUpperCase()}` : k.term;
}

export function latest<T>(values: readonly (T | null)[], since: number | null): T | null {
  if (since == null) return null;
  return values[values.length - 1] ?? null;
}

export function positionChangeOf(k: TrendKeyword, baseline: number | null) {
  if (k.since == null || baseline == null) return null;
  const start = Math.max(baseline, k.since);
  const end = k.position.length - 1;
  if (start >= end) return null;
  return (k.position[start] ?? 201) - (k.position[end] ?? 201);
}
