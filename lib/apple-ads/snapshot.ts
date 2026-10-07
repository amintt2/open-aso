import { amount, fetchAdGroupNegatives, fetchAdGroups, fetchCampaignNegatives, fetchCampaigns, type RawAdGroup, type RawCampaign, type RawNegative } from "./api";
import { pool } from "./client";
import { loadAttribution, toAttribution, type AttributionIndex } from "./attribution";
import { diagnoseKeyword, sumMetrics, suggestBid } from "./knowledge";
import {
  adGroupReport,
  campaignCountryReport,
  campaignReport,
  campaignTotalsReport,
  impressionShareIndex,
  keywordReport,
  storeKeywordDaily,
  syncImpressionShare,
  type AdGroupMeta,
  type CampaignMeta,
  type KeywordMeta,
  type ParsedRow,
} from "./reports";
import { emptyMetrics, type AdGroupKind, type AdsAdGroup, type AdsCampaign, type AdsKeyword, type AdsNegative, type AdsSnapshot, type CountryPoint, type DailyPoint, type ImpressionShare, type Metrics, type RangeDays } from "./types";

export type CampaignBundle = {
  campaignId: string;
  adGroups: RawAdGroup[];
  adGroupRows: ParsedRow<AdGroupMeta>[];
  keywordRows: ParsedRow<KeywordMeta>[];
  campaignNegatives: RawNegative[];
  adGroupNegatives: RawNegative[];
};

export type RawAccount = {
  orgId: string;
  currency: string;
  days: RangeDays;
  startDate: string;
  endDate: string;
  campaigns: RawCampaign[];
  campaignRows: ParsedRow<CampaignMeta>[];
  countryRows: ParsedRow<CampaignMeta>[] | null;
  bundles: CampaignBundle[];
  impressionShare: Map<string, ImpressionShare>;
  attribution: AttributionIndex | null;
  targetCpa: number | null;
  demo: boolean;
  warnings: string[];
};

export function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function dateRange(days: number, endOffset = 0) {
  const end = new Date();
  end.setDate(end.getDate() - endOffset);
  const start = new Date(end);
  start.setDate(start.getDate() - days + 1);
  return { start: isoDate(start), end: isoDate(end) };
}

export function eachDate(start: string, end: string) {
  const out: string[] = [];
  const d = new Date(`${start}T12:00:00`);
  const last = new Date(`${end}T12:00:00`);
  while (d <= last) {
    out.push(isoDate(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function adGroupKind(searchMatch: boolean, keywords: { matchType: string }[]): AdGroupKind {
  if (searchMatch) return keywords.length ? "mixed" : "search_match";
  if (!keywords.length) return "empty";
  if (keywords.every((k) => k.matchType === "EXACT")) return "exact";
  if (keywords.every((k) => k.matchType === "BROAD")) return "broad";
  return "mixed";
}

function negative(n: RawNegative, campaignId: string, adGroupId: string | null): AdsNegative {
  return { id: String(n.id), campaignId, adGroupId, text: n.text, matchType: n.matchType, status: n.status ?? "ACTIVE" };
}

export function assemble(raw: RawAccount): AdsSnapshot {
  const days = raw.days;
  const campaignRow = new Map(raw.campaignRows.map((r) => [String(r.meta.campaignId), r]));
  const campaigns: AdsCampaign[] = [];
  const adGroups: AdsAdGroup[] = [];
  const keywords: AdsKeyword[] = [];
  const negatives: AdsNegative[] = [];
  const bundles = new Map(raw.bundles.map((b) => [b.campaignId, b]));

  for (const c of raw.campaigns) {
    const id = String(c.id);
    const row = campaignRow.get(id);
    const metrics = row?.total ?? emptyMetrics();
    const dailyBudget = amount(c.dailyBudgetAmount);
    const country = (c.countriesOrRegions ?? [])[0] ?? null;
    campaigns.push({
      id,
      name: c.name,
      status: c.status,
      servingStatus: c.servingStatus ?? null,
      displayStatus: c.displayStatus ?? null,
      servingStateReasons: c.servingStateReasons ?? [],
      adamId: c.adamId,
      countries: c.countriesOrRegions ?? [],
      dailyBudget,
      currency: c.dailyBudgetAmount?.currency ?? raw.currency,
      supplySources: c.supplySources ?? [],
      biddingStrategy: c.biddingStrategy ?? null,
      metrics,
      attribution: raw.attribution ? toAttribution(raw.attribution.campaign.get(id) ?? { installs: 0, revenue: 0 }, metrics.spend) : null,
      budgetUtilization: dailyBudget ? metrics.spend / days / dailyBudget : null,
    });

    const bundle = bundles.get(id);
    if (!bundle) continue;
    for (const n of bundle.campaignNegatives) negatives.push(negative(n, id, null));
    for (const n of bundle.adGroupNegatives) negatives.push(negative(n, id, String(n.adGroupId ?? "")));
    const agRow = new Map(bundle.adGroupRows.map((r) => [String(r.meta.adGroupId), r]));
    for (const g of bundle.adGroups) {
      const gid = String(g.id);
      const kwRows = bundle.keywordRows.filter((k) => String(k.meta.adGroupId) === gid && !k.meta.deleted);
      const defaultBid = amount(g.defaultBidAmount) ?? 0;
      const cpaGoal = amount(g.cpaGoal);
      const gMetrics = agRow.get(gid)?.total ?? sumMetrics(kwRows.map((k) => k.total));
      adGroups.push({
        id: gid,
        campaignId: id,
        name: g.name,
        status: g.status,
        displayStatus: g.displayStatus ?? null,
        defaultBid,
        cpaGoal,
        searchMatch: !!g.automatedKeywordsOptIn,
        kind: adGroupKind(!!g.automatedKeywordsOptIn, kwRows.map((k) => ({ matchType: k.meta.matchType ?? "EXACT" }))),
        keywordCount: kwRows.length,
        metrics: gMetrics,
        attribution: raw.attribution ? toAttribution(raw.attribution.adGroup.get(gid) ?? { installs: 0, revenue: 0 }, gMetrics.spend) : null,
      });
      for (const k of kwRows) {
        const kid = String(k.meta.keywordId);
        const explicitBid = amount(k.meta.bidAmount);
        const bid = explicitBid && explicitBid > 0 ? explicitBid : defaultBid;
        const share = country ? (raw.impressionShare.get(`${c.adamId}|${country.toUpperCase()}|${k.meta.keyword.toLowerCase().trim()}`) ?? null) : null;
        const attribution = raw.attribution ? toAttribution(raw.attribution.keyword.get(kid) ?? { installs: 0, revenue: 0 }, k.total.spend) : null;
        const status = k.meta.keywordStatus === "PAUSED" ? "PAUSED" : "ACTIVE";
        const signal = {
          keywordId: kid,
          campaignId: id,
          adGroupId: gid,
          text: k.meta.keyword,
          status: c.status === "PAUSED" || g.status === "PAUSED" ? "PAUSED" : status,
          impressions: k.total.impressions,
          taps: k.total.taps,
          installs: k.total.installs,
          spend: k.total.spend,
          bid,
          suggestedBid: k.suggestedBid,
          impressionShare: share ? (share.low + share.high) / 2 : null,
          revenue: attribution && attribution.installs > 0 ? attribution.revenue : null,
          attributedInstalls: attribution?.installs ?? null,
          targetCpa: cpaGoal ?? raw.targetCpa,
          days,
        };
        const diagnosis = diagnoseKeyword(signal);
        keywords.push({
          id: kid,
          campaignId: id,
          adGroupId: gid,
          text: k.meta.keyword,
          matchType: k.meta.matchType ?? "EXACT",
          status,
          displayStatus: k.meta.keywordDisplayStatus ?? null,
          bid,
          bidIsDefault: !(explicitBid && explicitBid > 0),
          suggestedBid: k.suggestedBid,
          impressionShare: share,
          metrics: k.total,
          attribution,
          diagnosis,
          suggestion: suggestBid(signal, diagnosis),
        });
      }
    }
  }

  const dates = eachDate(raw.startDate, raw.endDate);
  const byDate = new Map<string, DailyPoint>(dates.map((d) => [d, { date: d, spend: 0, impressions: 0, taps: 0, installs: 0 }]));
  for (const r of raw.campaignRows)
    for (const d of r.daily) {
      const p = byDate.get(d.date);
      if (!p) continue;
      p.spend += d.spend;
      p.impressions += d.impressions;
      p.taps += d.taps;
      p.installs += d.installs;
    }

  const countryMap = new Map<string, CountryPoint>();
  const addCountry = (code: string, m: Metrics) => {
    const key = code.toLowerCase();
    const p = countryMap.get(key) ?? { country: key, spend: 0, installs: 0, impressions: 0, taps: 0 };
    p.spend += m.spend;
    p.installs += m.installs;
    p.impressions += m.impressions;
    p.taps += m.taps;
    countryMap.set(key, p);
  };
  if (raw.countryRows?.length) {
    for (const r of raw.countryRows) if (r.meta.countryOrRegion) addCountry(r.meta.countryOrRegion, r.total);
  } else {
    for (const c of campaigns) if (c.countries.length === 1) addCountry(c.countries[0], c.metrics);
  }

  return {
    orgId: raw.orgId,
    currency: raw.currency,
    days,
    startDate: raw.startDate,
    endDate: raw.endDate,
    campaigns: campaigns.sort((a, b) => b.metrics.spend - a.metrics.spend),
    adGroups,
    keywords,
    negatives,
    daily: [...byDate.values()],
    countries: [...countryMap.values()].sort((a, b) => b.spend - a.spend),
    generatedAt: new Date().toISOString(),
    demo: raw.demo,
    warnings: raw.warnings,
  };
}

export async function loadLiveAccount(orgId: string, currency: string, days: RangeDays, targetCpa: number | null): Promise<RawAccount> {
  const { start, end } = dateRange(days);
  const warnings: string[] = [];
  const [campaigns, campaignRows] = await Promise.all([fetchCampaigns(), campaignReport(start, end)]);
  const countryRows = await campaignCountryReport(start, end).catch((e: unknown) => {
    warnings.push(`Country breakdown unavailable: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  });
  const bundles = await pool(campaigns, 3, async (c): Promise<CampaignBundle> => {
    const id = String(c.id);
    try {
      const [adGroups, adGroupRows, keywordRows, campaignNegatives] = await Promise.all([
        fetchAdGroups(id),
        adGroupReport(id, start, end),
        keywordReport(id, start, end),
        fetchCampaignNegatives(id),
      ]);
      const adGroupNegatives = (await pool(adGroups, 3, (g) => fetchAdGroupNegatives(id, String(g.id)))).flat();
      storeKeywordDaily(orgId, id, (c.countriesOrRegions ?? [])[0]?.toLowerCase() ?? null, currency, keywordRows);
      return { campaignId: id, adGroups, adGroupRows, keywordRows, campaignNegatives, adGroupNegatives };
    } catch (e) {
      warnings.push(`${c.name}: details unavailable (${e instanceof Error ? e.message : String(e)})`);
      return { campaignId: id, adGroups: [], adGroupRows: [], keywordRows: [], campaignNegatives: [], adGroupNegatives: [] };
    }
  });
  const shareWarning = await syncImpressionShare(orgId, dateRange(14, 1).start, dateRange(14, 1).end);
  if (shareWarning) warnings.push(shareWarning);
  return {
    orgId,
    currency,
    days,
    startDate: start,
    endDate: end,
    campaigns,
    campaignRows,
    countryRows,
    bundles,
    impressionShare: impressionShareIndex(orgId),
    attribution: loadAttribution(start, end),
    targetCpa,
    demo: false,
    warnings,
  };
}

export async function loadPreviousTotals(days: RangeDays): Promise<Metrics | null> {
  const { start, end } = dateRange(days, days);
  try {
    const rows = await campaignTotalsReport(start, end);
    return sumMetrics(rows.map((r) => r.total));
  } catch {
    return null;
  }
}
