import { deriveMetrics, sumMetrics } from "./knowledge";
import { dateRange, eachDate, type CampaignBundle, type RawAccount } from "./snapshot";
import type { AttributionIndex } from "./attribution";
import type { AdGroupMeta, CampaignMeta, DailyMetrics, KeywordMeta, ParsedRow } from "./reports";
import type { RawAdGroup, RawCampaign, RawNegative } from "./api";
import type { ImpressionShare, MatchType, Metrics, RangeDays } from "./types";

export const DEMO_APP = { adamId: 6400000001, name: "Stride Habits" };
export const DEMO_ORG = { orgId: "demo", orgName: "Demo organization", currency: "USD" };

type KeywordProfile = {
  text: string;
  match: MatchType;
  bid: number | null;
  impressions: number;
  ttr: number;
  cr: number;
  cptRatio: number;
  suggested: number | null;
  share?: [number, number];
  rpi?: number;
  status?: "ACTIVE" | "PAUSED";
};

type GroupProfile = {
  name: string;
  defaultBid: number;
  searchMatch: boolean;
  searchMatchVolume?: number;
  keywords: KeywordProfile[];
  negatives?: string[];
  status?: "ENABLED" | "PAUSED";
};

type CampaignProfile = {
  name: string;
  country: string;
  budget: number;
  status: "ENABLED" | "PAUSED";
  groups: GroupProfile[];
};

const PROFILES: CampaignProfile[] = [
  {
    name: "StrideHabits_US_Exact_SR",
    country: "US",
    budget: 240,
    status: "ENABLED",
    groups: [
      {
        name: "StrideHabits_US_Exact_SR_Brand",
        defaultBid: 0.8,
        searchMatch: false,
        keywords: [
          { text: "stride habits", match: "EXACT", bid: 0.6, impressions: 160, ttr: 0.42, cr: 0.68, cptRatio: 0.45, suggested: 0.7, share: [0.81, 0.9], rpi: 4.1 },
          { text: "stride app", match: "EXACT", bid: 0.5, impressions: 40, ttr: 0.3, cr: 0.55, cptRatio: 0.5, suggested: 0.6, rpi: 3.6 },
        ],
      },
      {
        name: "StrideHabits_US_Exact_SR_Generic",
        defaultBid: 1.8,
        searchMatch: false,
        keywords: [
          { text: "habit tracker", match: "EXACT", bid: 2.4, impressions: 520, ttr: 0.11, cr: 0.46, cptRatio: 0.72, suggested: 2.9, share: [0.21, 0.3], rpi: 3.9 },
          { text: "daily planner", match: "EXACT", bid: 2.1, impressions: 380, ttr: 0.07, cr: 0.22, cptRatio: 0.9, suggested: 2.2, share: [0.41, 0.5], rpi: 2.2 },
          { text: "routine app", match: "EXACT", bid: 1.5, impressions: 150, ttr: 0.09, cr: 0.41, cptRatio: 0.7, suggested: 1.9, share: [0.11, 0.2], rpi: 4.4 },
          { text: "goal tracker", match: "EXACT", bid: 1.2, impressions: 0, ttr: 0, cr: 0, cptRatio: 0.7, suggested: 2.6 },
          { text: "self care app", match: "EXACT", bid: 1.6, impressions: 260, ttr: 0.012, cr: 0.36, cptRatio: 0.8, suggested: 1.4 },
          { text: "productivity planner", match: "EXACT", bid: 1.9, impressions: 140, ttr: 0.09, cr: 0, cptRatio: 0.85, suggested: 2.0 },
          { text: "morning routine", match: "EXACT", bid: 1.4, impressions: 18, ttr: 0.08, cr: 0.4, cptRatio: 0.7, suggested: 1.7 },
          { text: "streak tracker", match: "EXACT", bid: 1.1, impressions: 70, ttr: 0.1, cr: 0.38, cptRatio: 0.75, suggested: 1.3, rpi: 2.1, status: "PAUSED" },
        ],
      },
    ],
  },
  {
    name: "StrideHabits_US_Discovery_SR",
    country: "US",
    budget: 55,
    status: "ENABLED",
    groups: [
      {
        name: "StrideHabits_US_Broad_SR",
        defaultBid: 1.2,
        searchMatch: false,
        negatives: ["stride habits"],
        keywords: [
          { text: "habit tracker", match: "BROAD", bid: 1.3, impressions: 210, ttr: 0.08, cr: 0.35, cptRatio: 0.8, suggested: 2.4, rpi: 3.0 },
          { text: "habit", match: "BROAD", bid: 1.0, impressions: 330, ttr: 0.05, cr: 0.25, cptRatio: 0.85, suggested: 1.8, rpi: 2.4 },
          { text: "planner", match: "BROAD", bid: 0.9, impressions: 240, ttr: 0.04, cr: 0.2, cptRatio: 0.9, suggested: 1.6, rpi: 1.9 },
        ],
      },
      {
        name: "StrideHabits_US_SearchMatch_SR",
        defaultBid: 1.0,
        searchMatch: true,
        searchMatchVolume: 260,
        negatives: ["stride habits", "habit tracker"],
        keywords: [],
      },
    ],
  },
  {
    name: "StrideHabits_GB_Exact_SR",
    country: "GB",
    budget: 60,
    status: "ENABLED",
    groups: [
      {
        name: "StrideHabits_GB_Exact_SR",
        defaultBid: 1.4,
        searchMatch: false,
        keywords: [
          { text: "habit tracker", match: "EXACT", bid: 1.6, impressions: 240, ttr: 0.1, cr: 0.44, cptRatio: 0.7, suggested: 1.9, share: [0.31, 0.4], rpi: 3.4 },
          { text: "habit app", match: "EXACT", bid: 1.2, impressions: 110, ttr: 0.08, cr: 0.36, cptRatio: 0.75, suggested: 1.5, rpi: 2.6 },
          { text: "daily routine", match: "EXACT", bid: 1.0, impressions: 6, ttr: 0.1, cr: 0.3, cptRatio: 0.8, suggested: 1.4 },
        ],
      },
    ],
  },
  {
    name: "StrideHabits_DE_Exact_SR",
    country: "DE",
    budget: 20,
    status: "PAUSED",
    groups: [
      {
        name: "StrideHabits_DE_Exact_SR",
        defaultBid: 1.1,
        searchMatch: false,
        keywords: [
          { text: "gewohnheiten tracker", match: "EXACT", bid: 1.2, impressions: 90, ttr: 0.09, cr: 0.33, cptRatio: 0.75, suggested: 1.3, rpi: 2.9 },
          { text: "routine planer", match: "EXACT", bid: 0.9, impressions: 40, ttr: 0.07, cr: 0.3, cptRatio: 0.8, suggested: 1.1 },
        ],
      },
    ],
  },
  {
    name: "StrideHabits_CA_Exact_SR",
    country: "CA",
    budget: 20,
    status: "ENABLED",
    groups: [
      {
        name: "StrideHabits_CA_Exact_SR",
        defaultBid: 1.3,
        searchMatch: false,
        keywords: [
          { text: "habit tracker", match: "EXACT", bid: 1.5, impressions: 130, ttr: 0.1, cr: 0.42, cptRatio: 0.7, suggested: 1.8, share: [0.21, 0.3], rpi: 3.7 },
          { text: "routine tracker", match: "EXACT", bid: 1.1, impressions: 60, ttr: 0.08, cr: 0.37, cptRatio: 0.75, suggested: 1.4, rpi: 2.8 },
        ],
      },
    ],
  },
];

function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function dailySeries(seedKey: string, dates: string[], p: { impressions: number; ttr: number; cr: number; cpt: number; status: string }): DailyMetrics[] {
  const rand = seeded(hash(seedKey));
  return dates.map((date, i) => {
    if (p.status === "PAUSED" || p.impressions === 0) return { date, ...deriveMetrics({ impressions: 0, taps: 0, installs: 0, spend: 0 }) };
    const weekday = new Date(`${date}T12:00:00`).getDay();
    const season = 1 + 0.18 * Math.sin((i / 7) * Math.PI * 2) + (weekday === 0 || weekday === 6 ? 0.12 : 0);
    const impressions = Math.max(0, Math.round(p.impressions * season * (0.7 + rand() * 0.6)));
    const taps = Math.round(impressions * p.ttr * (0.75 + rand() * 0.5));
    const installs = Math.round(taps * p.cr * (0.7 + rand() * 0.6));
    const spend = Math.round(taps * p.cpt * (0.85 + rand() * 0.3) * 100) / 100;
    const newDownloads = Math.round(installs * 0.82);
    return { date, ...deriveMetrics({ impressions, taps, installs, spend, newDownloads, redownloads: installs - newDownloads }) };
  });
}

function sumDaily(series: DailyMetrics[][], dates: string[]): DailyMetrics[] {
  return dates.map((date, i) => ({ date, ...sumMetrics(series.map((s) => s[i]).filter(Boolean)) }));
}

function scaleRow(m: Metrics): Metrics {
  return deriveMetrics(m);
}

export function demoAccount(days: RangeDays, targetCpa: number | null): RawAccount {
  const { start, end } = dateRange(days);
  const dates = eachDate(start, end);
  const campaigns: RawCampaign[] = [];
  const campaignRows: ParsedRow<CampaignMeta>[] = [];
  const bundles: CampaignBundle[] = [];
  const impressionShare = new Map<string, ImpressionShare>();
  const attribution: AttributionIndex = { total: { installs: 0, revenue: 0 }, campaign: new Map(), adGroup: new Map(), keyword: new Map() };
  let kwId = 8100;
  let negId = 9100;

  PROFILES.forEach((cp, ci) => {
    const campaignId = 7100 + ci;
    campaigns.push({
      id: campaignId,
      orgId: 0,
      name: cp.name,
      adamId: DEMO_APP.adamId,
      status: cp.status,
      servingStatus: cp.status === "ENABLED" ? "RUNNING" : "NOT_RUNNING",
      displayStatus: cp.status === "ENABLED" ? "RUNNING" : "PAUSED",
      servingStateReasons: cp.status === "PAUSED" ? ["PAUSED_BY_USER"] : [],
      countriesOrRegions: [cp.country],
      dailyBudgetAmount: { amount: String(cp.budget), currency: DEMO_ORG.currency },
      supplySources: ["APPSTORE_SEARCH_RESULTS"],
      adChannelType: "SEARCH",
      billingEvent: "TAPS",
      biddingStrategy: "MANUAL_CPT",
    });
    const adGroups: RawAdGroup[] = [];
    const adGroupRows: ParsedRow<AdGroupMeta>[] = [];
    const keywordRows: ParsedRow<KeywordMeta>[] = [];
    const adGroupNegatives: RawNegative[] = [];
    const campaignSeries: DailyMetrics[][] = [];
    const campBucket = { installs: 0, revenue: 0 };

    cp.groups.forEach((gp, gi) => {
      const adGroupId = campaignId * 10 + gi;
      const groupStatus = gp.status ?? "ENABLED";
      adGroups.push({
        id: adGroupId,
        campaignId,
        name: gp.name,
        status: groupStatus,
        displayStatus: groupStatus === "ENABLED" && cp.status === "ENABLED" ? "RUNNING" : "PAUSED",
        defaultBidAmount: { amount: gp.defaultBid.toFixed(2), currency: DEMO_ORG.currency },
        cpaGoal: null,
        automatedKeywordsOptIn: gp.searchMatch,
      });
      for (const text of gp.negatives ?? []) adGroupNegatives.push({ id: negId++, campaignId, adGroupId, text, matchType: "EXACT", status: "ACTIVE" });
      const groupSeries: DailyMetrics[][] = [];
      const groupBucket = { installs: 0, revenue: 0 };
      for (const kp of gp.keywords) {
        const id = kwId++;
        const bid = kp.bid ?? gp.defaultBid;
        const status = kp.status ?? "ACTIVE";
        const live = cp.status === "ENABLED" && groupStatus === "ENABLED" && status === "ACTIVE" ? "ACTIVE" : "PAUSED";
        const daily = dailySeries(`${cp.name}|${gp.name}|${kp.text}`, dates, { impressions: kp.impressions, ttr: kp.ttr, cr: kp.cr, cpt: bid * kp.cptRatio, status: live });
        groupSeries.push(daily);
        const total = scaleRow(sumMetrics(daily));
        keywordRows.push({
          meta: {
            keywordId: id,
            keyword: kp.text,
            keywordStatus: status,
            keywordDisplayStatus: live === "ACTIVE" ? "RUNNING" : "PAUSED",
            matchType: kp.match,
            bidAmount: kp.bid == null ? null : { amount: kp.bid.toFixed(2), currency: DEMO_ORG.currency },
            adGroupId,
            adGroupName: gp.name,
          },
          total,
          daily,
          currency: DEMO_ORG.currency,
          suggestedBid: kp.suggested,
        });
        if (kp.share) impressionShare.set(`${DEMO_APP.adamId}|${cp.country}|${kp.text}`, { low: kp.share[0], high: kp.share[1], rank: kp.share[1] > 0.6 ? "1" : "2" });
        if (kp.rpi && total.installs > 0) {
          const attributed = Math.round(total.installs * 0.85);
          const bucket = { installs: attributed, revenue: Math.round(attributed * kp.rpi * 100) / 100 };
          attribution.keyword.set(String(id), bucket);
          groupBucket.installs += bucket.installs;
          groupBucket.revenue += bucket.revenue;
        }
      }
      if (gp.searchMatch && gp.searchMatchVolume)
        groupSeries.push(dailySeries(`${cp.name}|${gp.name}|search-match`, dates, { impressions: gp.searchMatchVolume, ttr: 0.06, cr: 0.3, cpt: gp.defaultBid * 0.7, status: cp.status === "ENABLED" ? "ACTIVE" : "PAUSED" }));
      const groupDaily = sumDaily(groupSeries, dates);
      campaignSeries.push(groupDaily);
      adGroupRows.push({ meta: { adGroupId, adGroupName: gp.name, campaignId }, total: sumMetrics(groupDaily), daily: [], currency: DEMO_ORG.currency, suggestedBid: null });
      attribution.adGroup.set(String(adGroupId), groupBucket);
      campBucket.installs += groupBucket.installs;
      campBucket.revenue += groupBucket.revenue;
    });

    const campaignDaily = sumDaily(campaignSeries, dates);
    campaignRows.push({
      meta: { campaignId, campaignName: cp.name, countriesOrRegions: [cp.country], adamId: DEMO_APP.adamId },
      total: sumMetrics(campaignDaily),
      daily: campaignDaily,
      currency: DEMO_ORG.currency,
      suggestedBid: null,
    });
    attribution.campaign.set(String(campaignId), campBucket);
    attribution.total.installs += campBucket.installs;
    attribution.total.revenue += campBucket.revenue;
    bundles.push({ campaignId: String(campaignId), adGroups, adGroupRows, keywordRows, campaignNegatives: [], adGroupNegatives });
  });

  return {
    orgId: DEMO_ORG.orgId,
    currency: DEMO_ORG.currency,
    days,
    startDate: start,
    endDate: end,
    campaigns,
    campaignRows,
    countryRows: null,
    bundles,
    impressionShare,
    attribution,
    targetCpa: targetCpa ?? 4,
    demo: true,
    warnings: [],
  };
}

export function demoPreviousTotals(days: RangeDays): Metrics {
  const current = demoAccount(days, null);
  const total = sumMetrics(current.campaignRows.map((r) => r.total));
  return deriveMetrics({ impressions: Math.round(total.impressions * 0.91), taps: Math.round(total.taps * 0.88), installs: Math.round(total.installs * 0.84), spend: Math.round(total.spend * 0.93 * 100) / 100 });
}

export function demoKeywordTrend(keywordId: string) {
  const account = demoAccount(90, null);
  for (const b of account.bundles) {
    const row = b.keywordRows.find((k) => String(k.meta.keywordId) === keywordId);
    if (row) return { keyword: row.meta.keyword, daily: row.daily };
  }
  return null;
}
