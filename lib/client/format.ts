const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });

export function formatCompact(n: number | null | undefined) {
  return n == null ? "—" : compact.format(n);
}

export function formatUsd(n: number | null | undefined) {
  return n == null ? "—" : usd.format(n);
}

export function formatMoney(n: number | null | undefined, currency = "USD") {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
}

export function formatPercent(n: number | null | undefined, digits = 1) {
  return n == null || !Number.isFinite(n) ? "—" : `${(n * 100).toFixed(digits)}%`;
}

export function timeAgo(iso: string | null | undefined) {
  if (!iso) return "never";
  const date = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  const s = Math.round((Date.now() - date.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return date.toLocaleDateString();
}
