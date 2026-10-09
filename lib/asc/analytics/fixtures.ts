import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import type { AscDocument, AscResource } from "@/lib/asc/client";
import type { DailyRow, ReportFamily, SourceType } from "./types";

export type FixtureMode = "data" | "waiting";

export type FixtureApp = { ascAppId: string; name: string; seed: number };

const DAY_MS = 86400000;

const TERRITORIES: [string, number][] = [
  ["US", 0.36], ["GB", 0.08], ["DE", 0.08], ["FR", 0.07], ["JP", 0.06], ["CA", 0.05], ["AU", 0.04], ["BR", 0.04], ["IN", 0.03],
  ["ES", 0.03], ["IT", 0.03], ["MX", 0.02], ["NL", 0.02], ["KR", 0.02], ["SE", 0.015], ["CH", 0.015], ["PL", 0.012], ["TR", 0.01], ["SG", 0.008],
];

const SOURCES: { label: string; impressions: number; pageView: number; cvr: number }[] = [
  { label: "App Store search", impressions: 0.58, pageView: 0.08, cvr: 0.042 },
  { label: "App Store browse", impressions: 0.27, pageView: 0.15, cvr: 0.016 },
  { label: "App referrer", impressions: 0.07, pageView: 0.55, cvr: 0.21 },
  { label: "Web referrer", impressions: 0.04, pageView: 0.7, cvr: 0.26 },
  { label: "Unavailable", impressions: 0.04, pageView: 0.3, cvr: 0.12 },
];

const DEVICES: [string, string, number][] = [
  ["iPhone", "iOS 26.0", 0.55],
  ["iPhone", "iOS 18.6", 0.3],
  ["iPad", "iOS 26.0", 0.15],
];

function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function noise(key: string) {
  return (hash(key) % 10000) / 10000;
}

function iso(t: number) {
  return new Date(t).toISOString().slice(0, 10);
}

function dayIndex(date: string) {
  return Math.floor(Date.parse(`${date}T00:00:00Z`) / DAY_MS);
}

function baseImpressions(app: FixtureApp, date: string) {
  const d = dayIndex(date);
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  const weekly = weekday === 0 || weekday === 6 ? 1.18 : 1;
  const trend = 1 + 0.0025 * (d % 365);
  const scale = 2600 + (app.seed % 7) * 600;
  return scale * weekly * trend * (0.85 + 0.3 * noise(`${app.seed}|${date}`));
}

type Line = Record<string, string | number>;

function engagementLines(app: FixtureApp, date: string): Line[] {
  const lines: Line[] = [];
  const base = baseImpressions(app, date);
  for (const [territory, tw] of TERRITORIES)
    for (const s of SOURCES)
      for (const [device, os, dw] of DEVICES) {
        const k = `${app.seed}|${date}|${territory}|${s.label}|${device}|${os}`;
        const impressions = Math.round(base * tw * s.impressions * dw * (0.8 + 0.4 * noise(`${k}|i`)));
        const unique = Math.round(impressions * (0.72 + 0.1 * noise(`${k}|u`)));
        const views = Math.round(unique * s.pageView * (0.8 + 0.4 * noise(`${k}|v`)));
        const common = { Date: date, "App Name": app.name, "App Apple Identifier": app.ascAppId, "Source Type": s.label, Device: device, "Platform Version": os, Territory: territory };
        if (impressions >= 3) lines.push({ ...common, Event: "Impression", "Page Type": "No page", "Engagement Type": "", Counts: impressions, "Unique Counts": unique });
        if (views >= 3) {
          const pageType = s.label === "App referrer" ? "Store sheet" : "Product page";
          const got = Math.round(views * 0.3);
          lines.push({ ...common, Event: "Page view", "Page Type": pageType, "Engagement Type": "", Counts: views - got, "Unique Counts": Math.round((views - got) * 0.86) });
          if (got >= 5) lines.push({ ...common, Event: "Page view", "Page Type": pageType, "Engagement Type": "Get", Counts: got, "Unique Counts": Math.round(got * 0.9) });
          lines.push({ ...common, Event: "Tap", "Page Type": "No page", "Engagement Type": "Get", Counts: Math.round(views * 0.4), "Unique Counts": Math.round(views * 0.38) });
        }
        if (territory === "US" && s.label === "App Store browse" && device === "iPhone") lines.push({ ...common, Event: "Page view", "Page Type": "In-app event", "Engagement Type": "", Counts: 40, "Unique Counts": 35 });
      }
  return lines;
}

function firstDownloads(app: FixtureApp, date: string, territory: string, tw: number, s: (typeof SOURCES)[number], dw: number, k: string) {
  const unique = baseImpressions(app, date) * tw * s.impressions * dw * 0.77;
  return Math.round(unique * s.cvr * (0.75 + 0.5 * noise(`${k}|d`)));
}

function downloadLines(app: FixtureApp, date: string): Line[] {
  const lines: Line[] = [];
  for (const [territory, tw] of TERRITORIES)
    for (const s of SOURCES)
      for (const [device, os, dw] of DEVICES) {
        const k = `${app.seed}|${date}|${territory}|${s.label}|${device}|${os}`;
        const first = firstDownloads(app, date, territory, tw, s, dw, k);
        const common = { Date: date, "App Name": app.name, "App Apple Identifier": app.ascAppId, "App Version": "3.4.1", Device: device, "Platform Version": os, "Source Type": s.label, "Page Type": "Product page", "Pre-Order": "", Territory: territory };
        const rows: [string, number][] = [
          ["First-time download", first],
          ["Redownload", Math.round(first * (0.22 + 0.1 * noise(`${k}|r`)))],
          ["Manual update", Math.round(first * 0.4)],
          ["Auto-update", Math.round(first * 1.6)],
          ["Restore", Math.round(first * 0.05)],
        ];
        for (const [type, counts] of rows) if (counts >= 1) lines.push({ ...common, "Download Type": type, Counts: counts });
      }
  return lines;
}

function purchaseLines(app: FixtureApp, date: string): Line[] {
  const lines: Line[] = [];
  for (const [territory, tw] of TERRITORIES)
    for (const s of SOURCES) {
      const k = `${app.seed}|${date}|${territory}|${s.label}|p`;
      const first = firstDownloads(app, date, territory, tw, s, 1, k);
      const purchases = Math.round(first * 0.06 * (0.6 + 0.8 * noise(k)));
      if (purchases < 1) continue;
      const price = 9.99;
      lines.push({
        Date: date, "App Name": app.name, "App Apple Identifier": app.ascAppId, "Purchase Type": "In-app purchase", "Content Name": "Pro Monthly", "Content Apple Identifier": "6400000001",
        "Payment Method": "Paid", Device: "iPhone", "Platform Version": "iOS 26.0", "Source Type": s.label, "Page Type": "Product page", "App Download Date": date, "Pre-Order": "",
        Territory: territory, Purchases: purchases, "Proceeds in USD": (purchases * price * 0.7).toFixed(2), "Sales in USD": (purchases * price).toFixed(2), "Paying Users": purchases,
      });
    }
  return lines;
}

const COLUMNS: Record<ReportFamily, string[]> = {
  engagement: ["Date", "App Name", "App Apple Identifier", "Event", "Page Type", "Source Type", "Engagement Type", "Device", "Platform Version", "Territory", "Counts", "Unique Counts"],
  downloads: ["Date", "App Name", "App Apple Identifier", "Download Type", "App Version", "Device", "Platform Version", "Source Type", "Page Type", "Pre-Order", "Territory", "Counts"],
  purchases: [
    "Date", "App Name", "App Apple Identifier", "Purchase Type", "Content Name", "Content Apple Identifier", "Payment Method", "Device", "Platform Version", "Source Type", "Page Type",
    "App Download Date", "Pre-Order", "Territory", "Purchases", "Proceeds in USD", "Sales in USD", "Paying Users",
  ],
};

export function fixtureReport(family: ReportFamily, app: FixtureApp, dates: string[]) {
  const make = family === "engagement" ? engagementLines : family === "downloads" ? downloadLines : purchaseLines;
  const lines = dates.flatMap((d) => make(app, d));
  return [COLUMNS[family].join("\t"), ...lines.map((l) => COLUMNS[family].map((c) => String(l[c] ?? "")).join("\t"))].join("\n") + "\n";
}

export function fixtureDates(to: string, days: number) {
  const end = Date.parse(`${to}T00:00:00Z`);
  return Array.from({ length: days }, (_, i) => iso(end - (days - 1 - i) * DAY_MS));
}

const REPORTS: { family: ReportFamily; name: string; category: string; tag: string }[] = [
  { family: "engagement", name: "App Store Discovery and Engagement Detailed", category: "APP_STORE_ENGAGEMENT", tag: "engd" },
  { family: "engagement", name: "App Store Discovery and Engagement Standard", category: "APP_STORE_ENGAGEMENT", tag: "engs" },
  { family: "downloads", name: "App Downloads Standard", category: "COMMERCE", tag: "dls" },
  { family: "downloads", name: "App Downloads Detailed", category: "COMMERCE", tag: "dld" },
  { family: "purchases", name: "App Store Purchases Standard", category: "COMMERCE", tag: "purs" },
  { family: "downloads", name: "App Store Pre-Order Standard", category: "COMMERCE", tag: "pre" },
];

function latestProcessingDate(now: number) {
  return new Date(now).getUTCHours() >= 13 ? iso(now) : iso(now - DAY_MS);
}

function instanceDates(requestKind: string, processingDate: string) {
  const p = Date.parse(`${processingDate}T00:00:00Z`);
  const span = requestKind === "snapshot" ? 7 : 2;
  return Array.from({ length: span }, (_, i) => iso(p - (span - i) * DAY_MS));
}

function processingDates(requestKind: string, now: number) {
  const latest = Date.parse(`${latestProcessingDate(now)}T00:00:00Z`);
  const today = Date.parse(`${iso(now)}T00:00:00Z`);
  if (requestKind === "snapshot") {
    const out: string[] = [];
    for (let t = today - 120 * DAY_MS; t <= today - 36 * DAY_MS; t += 7 * DAY_MS) out.push(iso(t));
    return out;
  }
  const out: string[] = [];
  for (let t = today - 34 * DAY_MS; t <= latest; t += DAY_MS) out.push(iso(t));
  return out;
}

function doc(data: AscResource[]): AscDocument {
  return { data, links: {} };
}

function segmentBody(app: FixtureApp, instanceId: string, part: number) {
  const [requestId, tag, processingDate] = instanceId.split("~");
  const report = REPORTS.find((r) => r.tag === tag);
  if (!report) return gzipSync("");
  const kind = requestId.includes("snapshot") ? "snapshot" : "ongoing";
  const dates = instanceDates(kind, processingDate);
  const text = report.tag === "pre" ? `${COLUMNS.downloads.join("\t")}\n` : fixtureReport(report.family, app, dates);
  if (report.family !== "engagement") return gzipSync(text);
  const [header, ...rows] = text.trimEnd().split("\n");
  const half = Math.ceil(rows.length / 2);
  const slice = part === 0 ? rows.slice(0, half) : rows.slice(half);
  return gzipSync(`${[header, ...slice].join("\n")}\n`);
}

export function fixtureTransport(app: FixtureApp, mode: FixtureMode, now = Date.now()) {
  const requestId = (kind: string) => `fx-${kind}-${app.ascAppId}`;
  async function get(path: string): Promise<AscDocument> {
    const url = new URL(path, "https://fixture.local");
    const parts = url.pathname.split("/").filter(Boolean);
    const filter = (name: string) => url.searchParams.get(`filter[${name}]`)?.split(",").filter(Boolean) ?? null;
    if (parts[1] === "apps" && parts[3] === "analyticsReportRequests") return doc([]);
    if (parts[1] === "analyticsReportRequests" && parts[3] === "reports") {
      if (mode === "waiting") return doc([]);
      const categories = filter("category");
      return doc(
        REPORTS.filter((r) => !categories || categories.includes(r.category)).map((r) => ({ type: "analyticsReports", id: `${parts[2]}~${r.tag}`, attributes: { name: r.name, category: r.category } })),
      );
    }
    if (parts[1] === "analyticsReports" && parts[3] === "instances") {
      const [rid] = parts[2].split("~");
      const kind = rid.includes("snapshot") ? "snapshot" : "ongoing";
      const wanted = filter("processingDate");
      const granularity = filter("granularity");
      if (granularity && !granularity.includes("DAILY")) return doc([]);
      return doc(
        processingDates(kind, now)
          .filter((d) => !wanted || wanted.includes(d))
          .reverse()
          .map((d) => ({ type: "analyticsReportInstances", id: `${parts[2]}~${d}`, attributes: { granularity: "DAILY", processingDate: d } })),
      );
    }
    if (parts[1] === "analyticsReportInstances" && parts[3] === "segments") {
      const instanceId = parts[2];
      const count = instanceId.split("~")[1].startsWith("eng") ? 2 : 1;
      return doc(
        Array.from({ length: count }, (_, i) => {
          const body = segmentBody(app, instanceId, i);
          return {
            type: "analyticsReportSegments",
            id: `${instanceId}~${i}`,
            attributes: { url: `fixture://${instanceId}~${i}`, checksum: createHash("md5").update(body).digest("hex"), sizeInBytes: body.length },
          };
        }),
      );
    }
    return doc([]);
  }
  async function post(_path: string, body: unknown) {
    const accessType = (body as { data?: { attributes?: { accessType?: string } } }).data?.attributes?.accessType ?? "ONGOING";
    return { data: { type: "analyticsReportRequests", id: requestId(accessType === "ONGOING" ? "ongoing" : "snapshot"), attributes: { accessType, stoppedDueToInactivity: false } } };
  }
  async function download(url: string) {
    const [, rest] = url.split("fixture://");
    const parts = rest.split("~");
    const part = Number(parts.pop());
    return segmentBody(app, parts.join("~"), part);
  }
  return { get, post, download };
}

const SOURCE_KEYS: Record<string, SourceType> = {
  "App Store search": "search",
  "App Store browse": "browse",
  "App referrer": "app_referrer",
  "Web referrer": "web_referrer",
  Unavailable: "unavailable",
};

export function fixtureDailyRows(app: FixtureApp, dates: string[]): DailyRow[] {
  const out: DailyRow[] = [];
  for (const date of dates) {
    const base = baseImpressions(app, date);
    for (const [territory, tw] of TERRITORIES)
      for (const s of SOURCES) {
        const k = `${app.seed}|${date}|${territory}|${s.label}|demo`;
        const impressions = Math.round(base * tw * s.impressions * (0.85 + 0.3 * noise(`${k}|i`)));
        const impressionsUnique = Math.round(impressions * 0.77);
        const pageViews = Math.round(impressionsUnique * s.pageView * (0.85 + 0.3 * noise(`${k}|v`)));
        const first = firstDownloads(app, date, territory, tw, s, 1, k);
        out.push({
          date,
          territory: territory.toLowerCase(),
          source: SOURCE_KEYS[s.label],
          impressions,
          impressionsUnique,
          pageViews,
          pageViewsUnique: Math.round(pageViews * 0.86),
          firstDownloads: first,
          redownloads: Math.round(first * (0.22 + 0.1 * noise(`${k}|r`))),
          updates: Math.round(first * 2),
          purchases: Math.round(first * 0.06),
          proceeds: Math.round(first * 0.06 * 9.99 * 0.7 * 100) / 100,
          sales: Math.round(first * 0.06 * 9.99 * 100) / 100,
        });
      }
  }
  return out;
}
