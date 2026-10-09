import { COUNTRIES } from "@/lib/appstore/countries";
import { ALPHA2_BY_ALPHA3 } from "@/lib/asc/territories";
import type { DailyRow, MetricKey, Metrics, ReportFamily, SourceType } from "./types";

export const FAMILY_METRICS: Record<ReportFamily, MetricKey[]> = {
  engagement: ["impressions", "impressionsUnique", "pageViews", "pageViewsUnique"],
  downloads: ["firstDownloads", "redownloads", "updates"],
  purchases: ["purchases", "proceeds", "sales"],
};

export const METRIC_COLUMNS: Record<MetricKey, string> = {
  impressions: "impressions",
  impressionsUnique: "impressions_unique",
  pageViews: "page_views",
  pageViewsUnique: "page_views_unique",
  firstDownloads: "first_downloads",
  redownloads: "redownloads",
  updates: "updates",
  purchases: "purchases",
  proceeds: "proceeds_usd",
  sales: "sales_usd",
};

export function emptyMetrics(): Metrics {
  return { impressions: 0, impressionsUnique: 0, pageViews: 0, pageViewsUnique: 0, firstDownloads: 0, redownloads: 0, updates: 0, purchases: 0, proceeds: 0, sales: 0 };
}

function normalizeHeader(value: string) {
  return value.replace(/^﻿/, "").replace(/^"|"$/g, "").trim().toLowerCase().replace(/[\s_-]+/g, " ");
}

function splitLine(line: string, delimiter: string) {
  if (!line.includes('"')) return line.split(delimiter);
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"' && cur === "") quoted = true;
    else if (ch === delimiter) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

export type ParsedReport = { columns: string[]; rows: Record<string, string>[] };

export function parseReport(text: string): ParsedReport {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  if (!lines.length) return { columns: [], rows: [] };
  const head = lines[0];
  const delimiter = (head.match(/\t/g)?.length ?? 0) >= (head.match(/,/g)?.length ?? 0) ? "\t" : ",";
  const columns = splitLine(head, delimiter).map(normalizeHeader);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i], delimiter);
    const row: Record<string, string> = {};
    columns.forEach((c, j) => (row[c] = (cells[j] ?? "").trim()));
    rows.push(row);
  }
  return { columns, rows };
}

function num(value: string | undefined) {
  if (!value) return 0;
  const n = Number(value.replace(/[,\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function pick(row: Record<string, string>, ...names: string[]) {
  for (const n of names) if (row[n] !== undefined) return row[n];
  return undefined;
}

const COUNTRY_BY_NAME = new Map(COUNTRIES.map((c) => [c.name.toLowerCase(), c.code]));
const NAME_ALIASES: Record<string, string> = {
  "united states of america": "us",
  usa: "us",
  "united kingdom of great britain and northern ireland": "gb",
  uk: "gb",
  "korea, republic of": "kr",
  "republic of korea": "kr",
  "south korea": "kr",
  "hong kong sar china": "hk",
  "hong kong sar": "hk",
  "taiwan, province of china": "tw",
  "mainland china": "cn",
  "china mainland": "cn",
  "russian federation": "ru",
  "viet nam": "vn",
  türkiye: "tr",
  turkiye: "tr",
};

export function normalizeTerritory(value: string | undefined) {
  const v = (value ?? "").trim();
  if (!v) return "zz";
  if (/^[A-Za-z]{2}$/.test(v)) return v.toLowerCase();
  if (/^[A-Za-z]{3}$/.test(v)) return ALPHA2_BY_ALPHA3[v.toUpperCase()] ?? v.toLowerCase();
  const lower = v.toLowerCase();
  return COUNTRY_BY_NAME.get(lower) ?? NAME_ALIASES[lower] ?? lower.replace(/[^a-z]+/g, "-").slice(0, 32);
}

export function normalizeSource(value: string | undefined): SourceType {
  const v = (value ?? "").trim().toLowerCase();
  if (!v || v === "unavailable" || v === "null" || v === "none") return "unavailable";
  if (v.includes("search")) return "search";
  if (v.includes("browse")) return "browse";
  if (v.includes("app referrer") || v === "app referral") return "app_referrer";
  if (v.includes("web referrer") || v === "web referral") return "web_referrer";
  if (v.includes("app clip")) return "app_clip";
  if (v.includes("notification")) return "notification";
  if (v.includes("institutional")) return "institutional";
  if (v.includes("in-store") || v.includes("in store")) return "in_store";
  return "other";
}

function normalizeDate(value: string | undefined) {
  const v = (value ?? "").trim();
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const us = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  return null;
}

const PAGE_VIEW_TYPES = new Set(["product page", "store sheet", ""]);

export type Aggregate = Map<string, DailyRow>;

function bucket(agg: Aggregate, date: string, territory: string, source: SourceType) {
  const key = `${date}|${territory}|${source}`;
  let row = agg.get(key);
  if (!row) {
    row = { date, territory, source, ...emptyMetrics() };
    agg.set(key, row);
  }
  return row;
}

export function aggregateReport(family: ReportFamily, report: ParsedReport, agg: Aggregate = new Map()): { agg: Aggregate; rows: number; skipped: number } {
  let rows = 0;
  let skipped = 0;
  for (const r of report.rows) {
    const date = normalizeDate(pick(r, "date"));
    if (!date) {
      skipped++;
      continue;
    }
    const territory = normalizeTerritory(pick(r, "territory", "country or region", "storefront"));
    const source = normalizeSource(pick(r, "source type", "source"));
    if (family === "engagement") {
      const event = (pick(r, "event") ?? "").toLowerCase();
      const counts = num(pick(r, "counts", "count"));
      const unique = num(pick(r, "unique counts", "unique count", "unique devices"));
      if (event.startsWith("impression")) {
        const b = bucket(agg, date, territory, source);
        b.impressions += counts;
        b.impressionsUnique += unique;
      } else if (event.startsWith("page view") && PAGE_VIEW_TYPES.has((pick(r, "page type") ?? "").toLowerCase())) {
        const b = bucket(agg, date, territory, source);
        b.pageViews += counts;
        b.pageViewsUnique += unique;
      } else {
        skipped++;
        continue;
      }
    } else if (family === "downloads") {
      const type = (pick(r, "download type") ?? "").toLowerCase();
      const counts = num(pick(r, "counts", "count"));
      if (type.startsWith("first")) bucket(agg, date, territory, source).firstDownloads += counts;
      else if (type.startsWith("redownload") || type.startsWith("re-download")) bucket(agg, date, territory, source).redownloads += counts;
      else if (type.includes("update")) bucket(agg, date, territory, source).updates += counts;
      else {
        skipped++;
        continue;
      }
    } else {
      const b = bucket(agg, date, territory, source);
      b.purchases += num(pick(r, "purchases"));
      b.proceeds += num(pick(r, "proceeds in usd", "proceeds"));
      b.sales += num(pick(r, "sales in usd", "sales"));
    }
    rows++;
  }
  return { agg, rows, skipped };
}
