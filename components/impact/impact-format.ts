import { COUNTRY_BY_CODE } from "@/lib/appstore/countries";
import { formatCompact, formatMoney, formatUsd } from "@/lib/client/format";

export const KEYWORD_COLORS = ["#3987e5", "#199e70", "#d95926", "#a66ee0", "#d6a21e", "#2fb5c7"];
export const OTHER_COLOR = "#6b7280";
export const BROWSE_COLOR = "#3f4550";
export const PAID_COLOR = "#e0567a";

export function formatEstimate(n: number | null | undefined) {
  if (n == null) return "—";
  if (n > 0 && n < 0.05) return "<0.1";
  if (n < 10) return (Math.round(n * 10) / 10).toString();
  return formatCompact(Math.round(n));
}

export function formatEstimateUsd(n: number | null | undefined) {
  if (n == null) return "—";
  if (n > 0 && n < 0.01) return "<$0.01";
  return n < 100 ? formatMoney(n) : formatUsd(n);
}

export function flagOf(code: string) {
  return COUNTRY_BY_CODE.get(code)?.flag ?? code.toUpperCase();
}

export function countryName(code: string) {
  return COUNTRY_BY_CODE.get(code)?.name ?? code.toUpperCase();
}
