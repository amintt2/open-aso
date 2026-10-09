import { COUNTRY_BY_CODE } from "@/lib/appstore/countries";
import type { SourceType, StorePoint } from "@/lib/asc/analytics/types";

export const SOURCE_META: Record<SourceType, { label: string; color: string }> = {
  search: { label: "App Store search", color: "#3987e5" },
  browse: { label: "App Store browse", color: "#199e70" },
  app_referrer: { label: "App referrer", color: "#d95926" },
  web_referrer: { label: "Web referrer", color: "#a66ee0" },
  app_clip: { label: "App Clip", color: "#d6a21e" },
  notification: { label: "Notification", color: "#2fb5c7" },
  institutional: { label: "Institutional", color: "#e0567a" },
  in_store: { label: "In-store purchase", color: "#8bbf3f" },
  unavailable: { label: "Unavailable", color: "#7f7f7f" },
  other: { label: "Other", color: "#454545" },
};

export function territoryName(code: string) {
  const c = COUNTRY_BY_CODE.get(code);
  if (c) return { name: c.name, flag: c.flag };
  if (/^[a-z]{2}$/.test(code)) {
    let name = code.toUpperCase();
    try {
      name = new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase()) ?? name;
    } catch {
      name = code.toUpperCase();
    }
    return { name, flag: code.toUpperCase().replace(/./g, (ch) => String.fromCodePoint(127397 + ch.charCodeAt(0))) };
  }
  return { name: code === "zz" ? "Unknown" : code, flag: "" };
}

export function formatDay(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function formatWhen(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now.getTime() + 86400000).toDateString() === d.toDateString();
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (sameDay) return `today ${time}`;
  if (tomorrow) return `tomorrow ${time}`;
  return `${d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} ${time}`;
}

export function formatUtcMinute(minute: number | null) {
  if (minute == null) return null;
  const d = new Date(Date.UTC(2000, 0, 1, Math.floor(minute / 60), minute % 60));
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function weekStart(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  const offset = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - offset * 86400000).toISOString().slice(0, 10);
}

const SUMMED = ["impressions", "impressionsUnique", "pageViews", "pageViewsUnique", "firstDownloads", "redownloads", "updates", "proceeds"] as const;

export function byWeek(points: StorePoint[]): StorePoint[] {
  const map = new Map<string, StorePoint>();
  for (const p of points) {
    const key = weekStart(p.date);
    const w = map.get(key) ?? { ...p, date: key, ...Object.fromEntries(SUMMED.map((k) => [k, 0])) };
    for (const k of SUMMED) w[k] += p[k];
    map.set(key, w);
  }
  return [...map.values()].map((w) => ({
    ...w,
    conversion: w.impressionsUnique > 0 ? w.firstDownloads / w.impressionsUnique : null,
    pageViewConversion: w.pageViewsUnique > 0 ? w.firstDownloads / w.pageViewsUnique : null,
  }));
}

export function bucketRows(rows: Record<string, number | string>[], week: boolean) {
  if (!week) return rows;
  const map = new Map<string, Record<string, number | string>>();
  for (const r of rows) {
    const key = weekStart(String(r.date));
    const w = map.get(key) ?? { date: key };
    for (const [k, v] of Object.entries(r)) if (k !== "date") w[k] = (Number(w[k]) || 0) + (Number(v) || 0);
    map.set(key, w);
  }
  return [...map.values()];
}
