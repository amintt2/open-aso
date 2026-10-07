import { adsRequest, type Envelope } from "./client";
import { amount, type RawMoney } from "./api";
import { db } from "@/lib/server/db";
import { deriveMetrics } from "./knowledge";
import type { ImpressionShare, MatchType, Metrics } from "./types";

type SpendRow = {
  impressions?: number;
  taps?: number;
  tapInstalls?: number;
  installs?: number;
  totalInstalls?: number;
  tapNewDownloads?: number;
  newDownloads?: number;
  tapRedownloads?: number;
  redownloads?: number;
  localSpend?: RawMoney;
  date?: string;
};

type Condition = { field: string; operator: "EQUALS" | "IN" | "STARTSWITH"; values: string[] };

type ReportRow<M> = {
  other?: boolean;
  metadata: M;
  total?: SpendRow;
  granularity?: SpendRow[];
  insights?: { bidRecommendation?: { suggestedBidAmount?: RawMoney } | null } | null;
};

type ReportResponse<M> = Envelope<{ reportingDataResponse?: { row?: ReportRow<M>[] } }>;

export type CampaignMeta = { campaignId: number; campaignName?: string; countriesOrRegions?: string[]; countryOrRegion?: string; adamId?: number; app?: { adamId?: number } };
export type AdGroupMeta = { adGroupId: number; adGroupName?: string; campaignId?: number };
export type KeywordMeta = {
  keywordId: number;
  keyword: string;
  keywordStatus?: string;
  keywordDisplayStatus?: string;
  matchType?: MatchType;
  bidAmount?: RawMoney;
  deleted?: boolean;
  adGroupId: number;
  adGroupName?: string;
  adGroupDeleted?: boolean;
};

export type DailyMetrics = { date: string } & Metrics;

export type ParsedRow<M> = {
  meta: M;
  total: Metrics;
  daily: DailyMetrics[];
  currency: string | null;
  suggestedBid: number | null;
};

export function normalizeDate(raw: string | undefined): string {
  if (!raw) return "";
  const mdY = /^(\d{2})-(\d{2})-(\d{4})/.exec(raw);
  if (mdY) return `${mdY[3]}-${mdY[1]}-${mdY[2]}`;
  return raw.slice(0, 10);
}

export function spendRowMetrics(row: SpendRow | undefined): Metrics {
  const r = row ?? {};
  return deriveMetrics({
    impressions: r.impressions ?? 0,
    taps: r.taps ?? 0,
    installs: r.tapInstalls ?? r.installs ?? r.totalInstalls ?? 0,
    newDownloads: r.tapNewDownloads ?? r.newDownloads ?? 0,
    redownloads: r.tapRedownloads ?? r.redownloads ?? 0,
    spend: amount(r.localSpend) ?? 0,
  });
}

function parse<M>(rows: ReportRow<M>[] | undefined): ParsedRow<M>[] {
  return (rows ?? [])
    .filter((r) => !r.other)
    .map((r) => {
      const daily = (r.granularity ?? []).map((d) => ({ date: normalizeDate(d.date), ...spendRowMetrics(d) }));
      const total = r.total ? spendRowMetrics(r.total) : deriveMetrics(daily.reduce((acc, d) => ({ impressions: acc.impressions + d.impressions, taps: acc.taps + d.taps, installs: acc.installs + d.installs, spend: acc.spend + d.spend, newDownloads: acc.newDownloads + d.newDownloads, redownloads: acc.redownloads + d.redownloads }), { impressions: 0, taps: 0, installs: 0, spend: 0, newDownloads: 0, redownloads: 0 }));
      const currency = r.total?.localSpend?.currency ?? r.granularity?.[0]?.localSpend?.currency ?? null;
      return { meta: r.metadata, total, daily, currency: currency && currency !== "null" ? currency : null, suggestedBid: amount(r.insights?.bidRecommendation?.suggestedBidAmount) };
    });
}

function request(start: string, end: string, opts: { daily?: boolean; groupBy?: string[]; conditions?: Condition[]; orderBy?: string; offset?: number }) {
  return {
    startTime: start,
    endTime: end,
    ...(opts.daily ? { granularity: "DAILY" } : {}),
    ...(opts.groupBy ? { groupBy: opts.groupBy } : {}),
    timeZone: "ORTZ",
    returnRecordsWithNoMetrics: true,
    returnRowTotals: true,
    returnGrandTotals: false,
    selector: {
      orderBy: [{ field: opts.orderBy ?? "localSpend", sortOrder: "DESCENDING" }],
      ...(opts.conditions?.length ? { conditions: opts.conditions } : {}),
      pagination: { offset: opts.offset ?? 0, limit: 1000 },
    },
  };
}

async function paged<M>(workspaceId: string, path: string, build: (offset: number) => object): Promise<ParsedRow<M>[]> {
  const out: ParsedRow<M>[] = [];
  for (let offset = 0; offset < 20_000; offset += 1000) {
    const res = await adsRequest<ReportResponse<M>>(workspaceId, "POST", path, { body: build(offset) });
    const rows = res.data?.reportingDataResponse?.row ?? [];
    out.push(...parse(rows));
    const total = res.pagination?.totalResults ?? rows.length;
    if (rows.length < 1000 || offset + rows.length >= total) break;
  }
  return out;
}

export function campaignReport(workspaceId: string, start: string, end: string) {
  return paged<CampaignMeta>(workspaceId, "/reports/campaigns", (offset) =>
    request(start, end, { daily: true, offset, conditions: [{ field: "deleted", operator: "IN", values: ["false"] }] }),
  );
}

export function campaignCountryReport(workspaceId: string, start: string, end: string) {
  return paged<CampaignMeta>(workspaceId, "/reports/campaigns", (offset) => request(start, end, { groupBy: ["countryOrRegion"], offset }));
}

export function adGroupReport(workspaceId: string, campaignId: string, start: string, end: string) {
  return paged<AdGroupMeta>(workspaceId, `/reports/campaigns/${campaignId}/adgroups`, (offset) =>
    request(start, end, { offset, conditions: [{ field: "deleted", operator: "IN", values: ["false"] }] }),
  );
}

export function keywordReport(workspaceId: string, campaignId: string, start: string, end: string) {
  return paged<KeywordMeta>(workspaceId, `/reports/campaigns/${campaignId}/keywords`, (offset) =>
    request(start, end, { daily: true, offset, conditions: [{ field: "deleted", operator: "IN", values: ["false"] }] }),
  );
}

const CHUNK = 2000;

export async function storeKeywordDaily(workspaceId: string, orgId: string, campaignId: string, country: string | null, currency: string, rows: ParsedRow<KeywordMeta>[]) {
  const flat = rows.flatMap((row) =>
    row.daily
      .filter((d) => d.date)
      .map((d) => [String(row.meta.adGroupId), String(row.meta.keywordId), row.meta.keyword, d.date, d.impressions, d.taps, d.installs, d.spend, row.currency ?? currency] as const),
  );
  const unique = [...new Map(flat.map((r) => [`${r[1]}|${r[3]}`, r])).values()];
  for (let i = 0; i < unique.length; i += CHUNK) {
    const part = unique.slice(i, i + CHUNK);
    const col = (n: number) => part.map((r) => r[n]);
    await db.run(
      `INSERT INTO ads_keyword_daily (workspace_id, org_id, campaign_id, ad_group_id, keyword_id, keyword, country, date, impressions, taps, installs, spend, currency)
       SELECT ?, ?, ?, t.ad_group_id, t.keyword_id, t.keyword, ?, t.date, t.impressions, t.taps, t.installs, t.spend, t.currency
       FROM unnest(?::text[], ?::text[], ?::text[], ?::date[], ?::int[], ?::int[], ?::int[], ?::float8[], ?::text[])
         AS t(ad_group_id, keyword_id, keyword, date, impressions, taps, installs, spend, currency)
       ON CONFLICT (workspace_id, keyword_id, date) DO UPDATE SET impressions = excluded.impressions, taps = excluded.taps, installs = excluded.installs,
         spend = excluded.spend, keyword = excluded.keyword, currency = excluded.currency, country = excluded.country, ad_group_id = excluded.ad_group_id,
         campaign_id = excluded.campaign_id, org_id = excluded.org_id`,
      [workspaceId, orgId, campaignId, country, col(0), col(1), col(2), col(3), col(4), col(5), col(6), col(7), col(8)],
    );
  }
}

export async function keywordDaily(workspaceId: string, keywordId: string) {
  return db.all<{ date: string; impressions: number; taps: number; installs: number; spend: number; keyword: string; currency: string | null }>(
    "SELECT date, impressions, taps, installs, spend, keyword, currency FROM ads_keyword_daily WHERE workspace_id = ? AND keyword_id = ? ORDER BY date ASC",
    [workspaceId, keywordId],
  );
}

type CustomReport = { id: number; state: string; downloadUri?: string | null };

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

function share(value: string | undefined) {
  if (!value) return null;
  const n = Number(value.replace("%", ""));
  if (!Number.isFinite(n)) return null;
  return n > 1 ? n / 100 : n;
}

async function importImpressionShare(workspaceId: string, orgId: string, uri: string) {
  const res = await fetch(uri, { cache: "no-store" });
  if (!res.ok) throw new Error(`Impression share download failed (HTTP ${res.status})`);
  const rows = parseCsv(await res.text());
  const [header, ...body] = rows;
  if (!header) return 0;
  const col = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase());
  const idx = { date: col("date"), adamId: col("adamId"), country: col("countryOrRegion"), term: col("searchTerm"), low: col("lowImpressionShare"), high: col("highImpressionShare"), rank: col("rank"), pop: col("searchPopularity") };
  if (idx.term < 0 || idx.country < 0) return 0;
  const today = new Date().toISOString().slice(0, 10);
  const parsed = body
    .filter((r) => r[idx.term] && r[idx.country])
    .map((r) => ({
      adamId: idx.adamId >= 0 ? (r[idx.adamId] ?? "") : "",
      country: r[idx.country].toUpperCase(),
      term: r[idx.term].toLowerCase().trim(),
      date: (idx.date >= 0 ? normalizeDate(r[idx.date]) : "") || today,
      low: share(r[idx.low]),
      high: share(r[idx.high]),
      rank: idx.rank >= 0 ? r[idx.rank] || null : null,
      pop: idx.pop >= 0 ? Number(r[idx.pop]) || null : null,
    }));
  const unique = [...new Map(parsed.map((r) => [`${r.adamId}|${r.country}|${r.term}|${r.date}`, r])).values()];
  for (let i = 0; i < unique.length; i += CHUNK) {
    const part = unique.slice(i, i + CHUNK);
    await db.run(
      `INSERT INTO ads_impression_share (workspace_id, org_id, adam_id, country, search_term, date, low, high, rank, popularity)
       SELECT ?, ?, t.adam_id, t.country, t.term, t.date, t.low, t.high, t.rank, t.pop
       FROM unnest(?::text[], ?::text[], ?::text[], ?::date[], ?::real[], ?::real[], ?::text[], ?::int[]) AS t(adam_id, country, term, date, low, high, rank, pop)
       ON CONFLICT (workspace_id, org_id, adam_id, country, search_term, date) DO UPDATE SET low = excluded.low, high = excluded.high, rank = excluded.rank, popularity = excluded.popularity`,
      [
        workspaceId,
        orgId,
        part.map((r) => r.adamId),
        part.map((r) => r.country),
        part.map((r) => r.term),
        part.map((r) => r.date),
        part.map((r) => r.low),
        part.map((r) => r.high),
        part.map((r) => r.rank),
        part.map((r) => (r.pop == null ? null : Math.round(r.pop))),
      ],
    );
  }
  return unique.length;
}

export async function syncImpressionShare(workspaceId: string, orgId: string, start: string, end: string): Promise<string | null> {
  const latest = await db.get<{ id: string; state: string; imported_at: string | null; created_at: string }>(
    "SELECT id, state, imported_at, created_at FROM ads_custom_reports WHERE workspace_id = ? AND org_id = ? ORDER BY created_at DESC LIMIT 1",
    [workspaceId, orgId],
  );
  try {
    if (latest && !latest.imported_at && latest.state !== "FAILED") {
      const res = await adsRequest<Envelope<CustomReport>>(workspaceId, "GET", `/custom-reports/${latest.id}`);
      const state = res.data?.state ?? "UNKNOWN";
      await db.run("UPDATE ads_custom_reports SET state = ? WHERE workspace_id = ? AND id = ?", [state, workspaceId, latest.id]);
      if (state === "COMPLETED" && res.data.downloadUri) {
        await importImpressionShare(workspaceId, orgId, res.data.downloadUri);
        await db.run("UPDATE ads_custom_reports SET imported_at = now() WHERE workspace_id = ? AND id = ?", [workspaceId, latest.id]);
      }
      return null;
    }
    const ageHours = latest ? (Date.now() - new Date(latest.created_at).getTime()) / 3_600_000 : Infinity;
    if (ageHours < 24) return null;
    const res = await adsRequest<Envelope<CustomReport>>(workspaceId, "POST", "/custom-reports", {
      body: { name: `open_aso_share_${end}`.slice(0, 50), startTime: start, endTime: end, granularity: "DAILY" },
    });
    if (res.data?.id)
      await db.run(
        `INSERT INTO ads_custom_reports (workspace_id, id, org_id, state, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (workspace_id, id) DO UPDATE SET org_id = excluded.org_id, state = excluded.state, start_date = excluded.start_date, end_date = excluded.end_date, imported_at = NULL, created_at = now()`,
        [workspaceId, String(res.data.id), orgId, res.data.state ?? "QUEUED", start, end],
      );
    return null;
  } catch (error) {
    return `Impression share unavailable: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function impressionShareIndex(workspaceId: string, orgId: string): Promise<Map<string, ImpressionShare>> {
  const rows = await db.all<{ adam_id: string; country: string; search_term: string; low: number | null; high: number | null; rank: string | null }>(
    `SELECT adam_id, country, search_term, AVG(low) AS low, AVG(high) AS high, MAX(rank) AS rank FROM ads_impression_share
     WHERE workspace_id = ? AND org_id = ? AND date >= current_date - 14 GROUP BY adam_id, country, search_term`,
    [workspaceId, orgId],
  );
  const map = new Map<string, ImpressionShare>();
  for (const r of rows) if (r.low != null && r.high != null) map.set(`${r.adam_id}|${r.country}|${r.search_term}`, { low: r.low, high: r.high, rank: r.rank });
  return map;
}

export function campaignTotalsReport(workspaceId: string, start: string, end: string) {
  return paged<CampaignMeta>(workspaceId, "/reports/campaigns", (offset) => request(start, end, { offset }));
}
