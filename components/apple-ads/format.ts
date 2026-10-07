import { COUNTRY_BY_CODE } from "@/lib/appstore/countries";

const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export function money(n: number | null | undefined, currency = "USD", digits = 2) {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
}

export function moneyCompact(n: number | null | undefined, currency = "USD") {
  if (n == null || !Number.isFinite(n)) return "—";
  if (Math.abs(n) < 10_000) return money(n, currency, n >= 1000 ? 0 : 2);
  return new Intl.NumberFormat("en-US", { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function count(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n >= 100_000 ? compact.format(n) : integer.format(n);
}

export function pct(n: number | null | undefined, digits = 1) {
  return n == null || !Number.isFinite(n) ? "—" : `${(n * 100).toFixed(digits)}%`;
}

export function multiple(n: number | null | undefined) {
  return n == null || !Number.isFinite(n) ? "—" : `${n.toFixed(2)}×`;
}

export function signedPct(n: number) {
  return `${n > 0 ? "+" : ""}${(n * 100).toFixed(0)}%`;
}

export function countryLabel(code: string | null | undefined) {
  if (!code) return "—";
  const c = COUNTRY_BY_CODE.get(code.toLowerCase());
  return c ? `${c.flag} ${c.code.toUpperCase()}` : code.toUpperCase();
}

export function countryName(code: string) {
  return COUNTRY_BY_CODE.get(code.toLowerCase())?.name ?? code.toUpperCase();
}

export function shortDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function parseTerms(text: string) {
  return [...new Set(text.split(/[\n,]+/).map((t) => t.trim().toLowerCase().replace(/\s+/g, " ")).filter(Boolean))];
}
