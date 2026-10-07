import type { AscProduct } from "@/lib/asc/types";

export function money(value: number | null | undefined, currency: string | null | undefined) {
  if (value == null) return "—";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency ?? "USD", maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency ?? ""}`.trim();
  }
}

export function pct(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  const rounded = Math.round(value * 1000) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(1)}%`;
}

const PERIOD: Record<string, string> = {
  ONE_WEEK: "Weekly",
  ONE_MONTH: "Monthly",
  TWO_MONTHS: "2 months",
  THREE_MONTHS: "3 months",
  SIX_MONTHS: "6 months",
  ONE_YEAR: "Yearly",
};

const IAP_TYPE: Record<string, string> = {
  CONSUMABLE: "Consumable",
  NON_CONSUMABLE: "Non-consumable",
  NON_RENEWING_SUBSCRIPTION: "Non-renewing",
};

export function productKindLabel(p: AscProduct) {
  if (p.kind === "subscription") return p.period ? (PERIOD[p.period] ?? p.period) : "Subscription";
  return p.type ? (IAP_TYPE[p.type] ?? p.type) : "In-app purchase";
}

export function stateLabel(state: string | null) {
  if (!state) return null;
  const s = state.replaceAll("_", " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function isoDate(offsetDays = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export function formatDate(date: string | null) {
  if (!date) return "Now";
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
