import { cached } from "@/lib/server/cache";
import { HttpError } from "@/lib/server/http";
import { AppleAdsError } from "./auth";
import {
  money,
  postAdGroup,
  postAdGroupNegatives,
  postCampaign,
  postCampaignNegatives,
  postKeywords,
  putAdGroup,
  putCampaign,
  putKeywords,
} from "./api";
import { currentOrgId } from "./client";
import { getConnection } from "./connection";
import { detectCannibalization } from "./cannibalization";
import { demoAccount, demoKeywordTrend, demoPreviousTotals } from "./demo";
import { exceedsCap, GUARDRAILS, ratio, sumMetrics, suggestBudgetChanges } from "./knowledge";
import { keywordDaily } from "./reports";
import { adsCacheKey, clearAdsCache, getPref, logChange, setPref } from "./prefs";
import { assemble, loadLiveAccount, loadPreviousTotals } from "./snapshot";
import type {
  AdGroupBidChange,
  AdGroupDetail,
  AdGroupPlanInput,
  AdsDashboard,
  AdsSnapshot,
  Attribution,
  BidChange,
  BudgetChange,
  CampaignDetail,
  CampaignPlan,
  CampaignPlanInput,
  CampaignStatus,
  ChangeResult,
  DiffRow,
  EntityStatusChange,
  KeywordInput,
  KeywordTrend,
  MatchType,
  Metrics,
  NegativeInput,
  PlannedCampaign,
  RangeDays,
} from "./types";

export { getConnection } from "./connection";
export { campaignAppMap, type CampaignAppLink } from "./snapshot";

export type SourceOpts = { demo?: boolean };
export type WriteOpts = { dryRun?: boolean; demo?: boolean; userId?: string | null };

const SNAPSHOT_TTL = 15 * 60 * 1000;

async function assertLive(workspaceId: string) {
  const c = await getConnection(workspaceId);
  if (!c.connected) throw new HttpError(409, "Apple Ads is not connected. Connect an account or open the demo preview.");
  return c;
}

export async function getTargetCpa(workspaceId: string): Promise<number | null> {
  const v = Number(await getPref(workspaceId, "targetCpa"));
  return Number.isFinite(v) && v > 0 ? v : null;
}

export async function setTargetCpa(workspaceId: string, value: number | null) {
  await setPref(workspaceId, "targetCpa", value && value > 0 ? String(value) : null);
  await clearAdsCache(workspaceId);
  return getTargetCpa(workspaceId);
}

export async function getSnapshot(workspaceId: string, opts: SourceOpts & { days?: RangeDays; refresh?: boolean } = {}): Promise<AdsSnapshot> {
  const days = opts.days ?? 30;
  if (opts.demo) return assemble(demoAccount(days, await getTargetCpa(workspaceId)));
  const c = await assertLive(workspaceId);
  if (opts.refresh) await clearAdsCache(workspaceId);
  return cached(adsCacheKey(workspaceId, `snapshot:${c.orgId}:${days}`), SNAPSHOT_TTL, async () =>
    assemble(await loadLiveAccount(workspaceId, c.orgId as string, c.currency, days, await getTargetCpa(workspaceId))),
  );
}

export async function refresh(workspaceId: string) {
  await clearAdsCache(workspaceId);
}

function totalAttribution(s: AdsSnapshot, spend: number): Attribution | null {
  const list = s.campaigns.map((c) => c.attribution).filter((a): a is Attribution => a !== null);
  if (!list.length) return null;
  const installs = list.reduce((n, a) => n + a.installs, 0);
  const revenue = list.reduce((n, a) => n + a.revenue, 0);
  if (!installs && !revenue) return null;
  return { installs, revenue, rpi: installs ? revenue / installs : null, roas: spend > 0 ? revenue / spend : null };
}

export async function getDashboard(workspaceId: string, opts: SourceOpts & { days?: RangeDays; refresh?: boolean } = {}): Promise<AdsDashboard> {
  const s = await getSnapshot(workspaceId, opts);
  const totals = sumMetrics(s.campaigns.map((c) => c.metrics));
  const previousTotals = opts.demo
    ? demoPreviousTotals(s.days)
    : await cached<Metrics | null>(adsCacheKey(workspaceId, `prev:${s.orgId}:${s.days}`), SNAPSHOT_TTL, () => loadPreviousTotals(workspaceId, s.days));
  const savedCpa = await getTargetCpa(workspaceId);
  const targetCpa = s.demo ? (savedCpa ?? 4) : savedCpa;
  return {
    demo: s.demo,
    currency: s.currency,
    days: s.days,
    startDate: s.startDate,
    endDate: s.endDate,
    totals,
    previousTotals,
    attribution: totalAttribution(s, totals.spend),
    daily: s.daily,
    countries: s.countries,
    campaigns: s.campaigns,
    bidSuggestions: s.keywords.map((k) => k.suggestion).filter((x): x is NonNullable<typeof x> => x !== null),
    budgetSuggestions: suggestBudgetChanges(
      s.campaigns.map((c) => ({
        campaignId: c.id,
        name: c.name,
        status: c.status,
        dailyBudget: c.dailyBudget,
        spend: c.metrics.spend,
        installs: c.metrics.installs,
        days: s.days,
        targetCpa,
        revenue: c.attribution && c.attribution.installs > 0 ? c.attribution.revenue : null,
        attributedInstalls: c.attribution?.installs ?? null,
      })),
    ),
    cannibalization: detectCannibalization(s),
    targetCpa,
    generatedAt: s.generatedAt,
    warnings: s.warnings,
  };
}

export async function listCampaigns(workspaceId: string, opts: SourceOpts & { days?: RangeDays } = {}) {
  return (await getSnapshot(workspaceId, opts)).campaigns;
}

export async function getPerformance(workspaceId: string, opts: SourceOpts & { days?: RangeDays } = {}) {
  const d = await getDashboard(workspaceId, opts);
  const s = await getSnapshot(workspaceId, opts);
  return {
    demo: d.demo,
    currency: d.currency,
    range: { days: d.days, start: d.startDate, end: d.endDate },
    totals: d.totals,
    previousTotals: d.previousTotals,
    attribution: d.attribution,
    campaigns: d.campaigns.map((c) => ({ id: c.id, name: c.name, status: c.status, countries: c.countries, dailyBudget: c.dailyBudget, metrics: c.metrics, attribution: c.attribution })),
    topKeywords: [...s.keywords]
      .sort((a, b) => b.metrics.spend - a.metrics.spend)
      .slice(0, 25)
      .map((k) => ({ id: k.id, campaignId: k.campaignId, adGroupId: k.adGroupId, text: k.text, matchType: k.matchType, status: k.status, bid: k.bid, metrics: k.metrics, diagnosis: k.diagnosis, suggestion: k.suggestion })),
    bidSuggestions: d.bidSuggestions,
    budgetSuggestions: d.budgetSuggestions,
    cannibalization: d.cannibalization,
  };
}

export async function getCampaignDetail(workspaceId: string, campaignId: string, opts: SourceOpts & { days?: RangeDays } = {}): Promise<CampaignDetail> {
  const s = await getSnapshot(workspaceId, opts);
  const campaign = s.campaigns.find((c) => c.id === campaignId);
  if (!campaign) throw new HttpError(404, "Campaign not found");
  return {
    campaign,
    adGroups: s.adGroups.filter((g) => g.campaignId === campaignId),
    negatives: s.negatives.filter((n) => n.campaignId === campaignId && !n.adGroupId),
    demo: s.demo,
  };
}

export async function getAdGroupDetail(workspaceId: string, campaignId: string, adGroupId: string, opts: SourceOpts & { days?: RangeDays } = {}): Promise<AdGroupDetail> {
  const s = await getSnapshot(workspaceId, opts);
  const campaign = s.campaigns.find((c) => c.id === campaignId);
  const adGroup = s.adGroups.find((g) => g.id === adGroupId && g.campaignId === campaignId);
  if (!campaign || !adGroup) throw new HttpError(404, "Ad group not found");
  return {
    campaign,
    adGroup,
    keywords: s.keywords.filter((k) => k.adGroupId === adGroupId).sort((a, b) => b.metrics.spend - a.metrics.spend || b.metrics.impressions - a.metrics.impressions),
    negatives: s.negatives.filter((n) => n.adGroupId === adGroupId),
    campaignNegatives: s.negatives.filter((n) => n.campaignId === campaignId && !n.adGroupId),
    demo: s.demo,
  };
}

export async function getKeywordTrend(workspaceId: string, keywordId: string, opts: SourceOpts = {}): Promise<KeywordTrend> {
  const withRatios = (rows: { date: string; impressions: number; taps: number; installs: number; spend: number }[]) =>
    rows.map((r) => ({ date: r.date, impressions: r.impressions, taps: r.taps, installs: r.installs, spend: r.spend, cpa: ratio(r.spend, r.installs), cpt: ratio(r.spend, r.taps) }));
  if (opts.demo) {
    const t = demoKeywordTrend(keywordId);
    if (!t) throw new HttpError(404, "Keyword not found");
    return { keywordId, keyword: t.keyword, currency: "USD", points: withRatios(t.daily), demo: true };
  }
  const c = await assertLive(workspaceId);
  let rows = await keywordDaily(workspaceId, keywordId);
  if (!rows.length) {
    await getSnapshot(workspaceId, { days: 90 });
    rows = await keywordDaily(workspaceId, keywordId);
  }
  if (!rows.length) throw new HttpError(404, "No daily data stored for this keyword yet");
  return { keywordId, keyword: rows[rows.length - 1].keyword, currency: rows[rows.length - 1].currency ?? c.currency, points: withRatios(rows), demo: false };
}

function fmtMoney(n: number | null | undefined, currency: string) {
  if (n == null) return "default";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
}

function errorText(e: unknown) {
  if (e instanceof AppleAdsError || e instanceof HttpError || e instanceof Error) return e.message;
  return String(e);
}

type Step = { entity: string; run: () => Promise<unknown> };

async function execute(workspaceId: string, action: string, payload: unknown, changes: DiffRow[], warnings: string[], opts: WriteOpts, steps: Step[], sequential = false): Promise<ChangeResult> {
  const demo = !!opts.demo;
  if (demo || opts.dryRun) return { dryRun: true, demo, changes, warnings, results: [] };
  if (!changes.length) return { dryRun: false, demo: false, changes, warnings, results: [] };
  const results: ChangeResult["results"] = [];
  for (const step of steps) {
    try {
      await step.run();
      results.push({ entity: step.entity, ok: true });
    } catch (e) {
      results.push({ entity: step.entity, ok: false, error: errorText(e) });
      if (sequential) break;
    }
  }
  await logChange(workspaceId, (await getConnection(workspaceId)).orgId, action, payload, results, results.every((r) => r.ok), opts.userId ?? null);
  await clearAdsCache(workspaceId);
  return { dryRun: false, demo: false, changes, warnings, results };
}

async function context(workspaceId: string, opts: WriteOpts) {
  const s = await getSnapshot(workspaceId, { demo: opts.demo, days: 30 });
  return {
    s,
    currency: s.currency,
    campaign: (id: string) => s.campaigns.find((c) => c.id === id),
    adGroup: (id: string) => s.adGroups.find((g) => g.id === id),
    keyword: (id: string) => s.keywords.find((k) => k.id === id),
  };
}

export async function updateBids(workspaceId: string, changes: BidChange[], opts: WriteOpts & { enforceCaps?: boolean } = {}): Promise<ChangeResult> {
  const ctx = await context(workspaceId, opts);
  const diff: DiffRow[] = [];
  const warnings: string[] = [];
  const groups = new Map<string, { campaignId: string; adGroupId: string; updates: { id: number; bidAmount: { amount: string; currency: string } }[] }>();
  for (const ch of changes) {
    if (!(ch.bid > 0)) throw new HttpError(400, "Bids must be greater than zero");
    const k = ctx.keyword(ch.keywordId);
    const before = k?.bid ?? null;
    let bid = Math.round(ch.bid * 100) / 100;
    let warning: string | undefined;
    if (before != null && exceedsCap(before, bid, GUARDRAILS.maxBidChange)) {
      if (opts.enforceCaps) {
        bid = Math.round((bid > before ? before * (1 + GUARDRAILS.maxBidChange) : before * (1 - GUARDRAILS.maxBidChange)) * 100) / 100;
        warning = "Capped at ±30%";
      } else warning = "Changes more than 30% at once";
    }
    if (warning) warnings.push(`${k?.text ?? ch.keywordId}: ${warning.toLowerCase()}`);
    if (before != null && Math.abs(before - bid) < 0.005) continue;
    diff.push({ entity: k ? `"${k.text}" · ${ctx.adGroup(k.adGroupId)?.name ?? k.adGroupId}` : `Keyword ${ch.keywordId}`, field: "Max CPT bid", before: before == null ? null : fmtMoney(before, ctx.currency), after: fmtMoney(bid, ctx.currency), warning });
    const key = `${ch.campaignId}|${ch.adGroupId}`;
    const g = groups.get(key) ?? { campaignId: ch.campaignId, adGroupId: ch.adGroupId, updates: [] };
    g.updates.push({ id: Number(ch.keywordId), bidAmount: money(bid, ctx.currency) });
    groups.set(key, g);
  }
  return execute(workspaceId, "updateBids", changes, diff, warnings, opts, [...groups.values()].map((g) => ({ entity: `${g.updates.length} keyword bid(s) in ${ctx.adGroup(g.adGroupId)?.name ?? g.adGroupId}`, run: () => putKeywords(workspaceId, g.campaignId, g.adGroupId, g.updates) })));
}

export async function updateAdGroupBids(workspaceId: string, changes: AdGroupBidChange[], opts: WriteOpts = {}): Promise<ChangeResult> {
  const ctx = await context(workspaceId, opts);
  const diff: DiffRow[] = [];
  const warnings: string[] = [];
  const steps: Step[] = [];
  for (const ch of changes) {
    if (!(ch.defaultBid > 0)) throw new HttpError(400, "Default bids must be greater than zero");
    const g = ctx.adGroup(ch.adGroupId);
    const before = g?.defaultBid ?? null;
    const warning = before != null && exceedsCap(before, ch.defaultBid, GUARDRAILS.maxBidChange) ? "Changes more than 30% at once" : undefined;
    if (warning) warnings.push(`${g?.name ?? ch.adGroupId}: ${warning.toLowerCase()}`);
    diff.push({ entity: g?.name ?? `Ad group ${ch.adGroupId}`, field: "Default max CPT bid", before: before == null ? null : fmtMoney(before, ctx.currency), after: fmtMoney(ch.defaultBid, ctx.currency), warning });
    steps.push({ entity: g?.name ?? ch.adGroupId, run: () => putAdGroup(workspaceId, ch.campaignId, ch.adGroupId, { defaultBidAmount: money(ch.defaultBid, ctx.currency) }) });
  }
  return execute(workspaceId, "updateAdGroupBids", changes, diff, warnings, opts, steps);
}

export async function setSearchMatch(workspaceId: string, change: { campaignId: string; adGroupId: string; enabled: boolean }, opts: WriteOpts = {}): Promise<ChangeResult> {
  const ctx = await context(workspaceId, opts);
  const g = ctx.adGroup(change.adGroupId);
  const warnings = change.enabled && g?.kind === "exact" ? ["Search Match in an exact-match ad group mixes uncontrolled queries into keywords you are pricing. Prefer a separate discovery group."] : [];
  const diff: DiffRow[] = [{ entity: g?.name ?? `Ad group ${change.adGroupId}`, field: "Search Match", before: g ? (g.searchMatch ? "On" : "Off") : null, after: change.enabled ? "On" : "Off", warning: warnings[0] }];
  return execute(workspaceId, "setSearchMatch", change, diff, warnings, opts, [{ entity: g?.name ?? change.adGroupId, run: () => putAdGroup(workspaceId, change.campaignId, change.adGroupId, { automatedKeywordsOptIn: change.enabled }) }]);
}

export async function updateBudgets(workspaceId: string, changes: BudgetChange[], opts: WriteOpts & { enforceCaps?: boolean } = {}): Promise<ChangeResult> {
  const ctx = await context(workspaceId, opts);
  const diff: DiffRow[] = [];
  const warnings: string[] = [];
  const steps: Step[] = [];
  for (const ch of changes) {
    if (!(ch.dailyBudget > 0)) throw new HttpError(400, "Daily budgets must be greater than zero");
    const c = ctx.campaign(ch.campaignId);
    const before = c?.dailyBudget ?? null;
    let budget = Math.round(ch.dailyBudget * 100) / 100;
    let warning: string | undefined;
    if (before != null && budget > before * (1 + GUARDRAILS.maxBudgetIncrease) + 1e-9) {
      if (opts.enforceCaps) {
        budget = Math.round(before * (1 + GUARDRAILS.maxBudgetIncrease) * 100) / 100;
        warning = "Capped at +30%";
      } else warning = "Raises the budget more than 30% in one step";
      warnings.push(`${c?.name ?? ch.campaignId}: ${warning.toLowerCase()}`);
    }
    const currency = c?.currency ?? ctx.currency;
    diff.push({ entity: c?.name ?? `Campaign ${ch.campaignId}`, field: "Daily budget", before: before == null ? null : fmtMoney(before, currency), after: fmtMoney(budget, currency), warning });
    steps.push({ entity: c?.name ?? ch.campaignId, run: () => putCampaign(workspaceId, ch.campaignId, { dailyBudgetAmount: money(budget, currency) }) });
  }
  return execute(workspaceId, "updateBudgets", changes, diff, warnings, opts, steps);
}

export async function pauseEntities(workspaceId: string, entities: EntityStatusChange[], opts: WriteOpts = {}): Promise<ChangeResult> {
  const ctx = await context(workspaceId, opts);
  const diff: DiffRow[] = [];
  const steps: Step[] = [];
  const keywordGroups = new Map<string, { campaignId: string; adGroupId: string; updates: { id: number; status: "ACTIVE" | "PAUSED" }[] }>();
  for (const e of entities) {
    if (e.type === "campaign") {
      const c = ctx.campaign(e.campaignId);
      diff.push({ entity: c?.name ?? `Campaign ${e.campaignId}`, field: "Status", before: c?.status ?? null, after: e.status });
      steps.push({ entity: c?.name ?? e.campaignId, run: () => putCampaign(workspaceId, e.campaignId, { status: e.status }) });
    } else if (e.type === "adgroup") {
      const g = ctx.adGroup(e.adGroupId);
      diff.push({ entity: g?.name ?? `Ad group ${e.adGroupId}`, field: "Status", before: g?.status ?? null, after: e.status });
      steps.push({ entity: g?.name ?? e.adGroupId, run: () => putAdGroup(workspaceId, e.campaignId, e.adGroupId, { status: e.status }) });
    } else {
      const k = ctx.keyword(e.keywordId);
      diff.push({ entity: k ? `"${k.text}"` : `Keyword ${e.keywordId}`, field: "Status", before: k?.status ?? null, after: e.status });
      const key = `${e.campaignId}|${e.adGroupId}`;
      const g = keywordGroups.get(key) ?? { campaignId: e.campaignId, adGroupId: e.adGroupId, updates: [] };
      g.updates.push({ id: Number(e.keywordId), status: e.status });
      keywordGroups.set(key, g);
    }
  }
  for (const g of keywordGroups.values()) steps.push({ entity: `${g.updates.length} keyword(s) in ${ctx.adGroup(g.adGroupId)?.name ?? g.adGroupId}`, run: () => putKeywords(workspaceId, g.campaignId, g.adGroupId, g.updates) });
  return execute(workspaceId, "setStatus", entities, diff, [], opts, steps);
}

function cleanTerms<T extends { text: string }>(list: T[]) {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of list) {
    const text = item.text.toLowerCase().trim().replace(/\s+/g, " ");
    if (!text || text.length > 80 || seen.has(text)) continue;
    seen.add(text);
    out.push({ ...item, text });
  }
  return out;
}

export async function addKeywords(workspaceId: string, input: { campaignId: string; adGroupId: string; keywords: KeywordInput[] }, opts: WriteOpts = {}): Promise<ChangeResult> {
  const ctx = await context(workspaceId, opts);
  const g = ctx.adGroup(input.adGroupId);
  const existing = new Set(ctx.s.keywords.filter((k) => k.adGroupId === input.adGroupId).map((k) => `${k.matchType}:${k.text.toLowerCase()}`));
  const warnings: string[] = [];
  const list = cleanTerms(input.keywords).filter((k) => {
    const dup = existing.has(`${k.matchType ?? "EXACT"}:${k.text}`);
    if (dup) warnings.push(`"${k.text}" is already in this ad group`);
    return !dup;
  });
  if (g?.kind === "exact" && list.some((k) => k.matchType === "BROAD")) warnings.push("Adding broad match keywords to an exact-match ad group blurs bid control. Prefer a separate discovery group.");
  const diff: DiffRow[] = list.map((k) => ({
    entity: g?.name ?? `Ad group ${input.adGroupId}`,
    field: `Add ${(k.matchType ?? "EXACT").toLowerCase()} keyword`,
    before: null,
    after: `"${k.text}" · ${fmtMoney(k.bid ?? g?.defaultBid ?? null, ctx.currency)}`,
  }));
  const body = list.map((k) => ({ text: k.text, matchType: k.matchType ?? ("EXACT" as MatchType), status: "ACTIVE" as const, ...(k.bid ? { bidAmount: money(k.bid, ctx.currency) } : {}) }));
  return execute(workspaceId, "addKeywords", input, diff, warnings, opts, body.length ? [{ entity: `${body.length} keyword(s) → ${g?.name ?? input.adGroupId}`, run: () => postKeywords(workspaceId, input.campaignId, input.adGroupId, body) }] : []);
}

export async function addNegativeKeywords(workspaceId: string, input: { campaignId: string; adGroupId?: string | null; keywords: NegativeInput[] }, opts: WriteOpts = {}): Promise<ChangeResult> {
  const ctx = await context(workspaceId, opts);
  const scope = input.adGroupId ? ctx.adGroup(input.adGroupId)?.name : ctx.campaign(input.campaignId)?.name;
  const existing = new Set(
    ctx.s.negatives.filter((n) => (input.adGroupId ? n.adGroupId === input.adGroupId : n.campaignId === input.campaignId && !n.adGroupId)).map((n) => `${n.matchType}:${n.text.toLowerCase()}`),
  );
  const warnings: string[] = [];
  const list = cleanTerms(input.keywords).filter((k) => {
    const dup = existing.has(`${k.matchType ?? "EXACT"}:${k.text}`);
    if (dup) warnings.push(`"${k.text}" is already a negative here`);
    return !dup;
  });
  const targeted = new Set(ctx.s.keywords.filter((k) => (input.adGroupId ? k.adGroupId === input.adGroupId : k.campaignId === input.campaignId) && k.status === "ACTIVE").map((k) => k.text.toLowerCase()));
  for (const k of list) if (targeted.has(k.text)) warnings.push(`"${k.text}" is also an active keyword here; the negative will block it`);
  const label = `${input.adGroupId ? "Ad group" : "Campaign"} ${scope ?? input.adGroupId ?? input.campaignId}`;
  const diff: DiffRow[] = list.map((k) => ({ entity: label, field: `Add negative ${(k.matchType ?? "EXACT").toLowerCase()}`, before: null, after: `"${k.text}"` }));
  const body = list.map((k) => ({ text: k.text, matchType: k.matchType ?? ("EXACT" as MatchType) }));
  const run = () => (input.adGroupId ? postAdGroupNegatives(workspaceId, input.campaignId, input.adGroupId, body) : postCampaignNegatives(workspaceId, input.campaignId, body));
  return execute(workspaceId, "addNegativeKeywords", input, diff, warnings, opts, body.length ? [{ entity: `${body.length} negative(s) → ${label}`, run }] : []);
}

export async function fixCannibalization(workspaceId: string, issueIds: string[] | "all", opts: WriteOpts = {}): Promise<ChangeResult> {
  const s = await getSnapshot(workspaceId, { demo: opts.demo, days: 30 });
  const issues = detectCannibalization(s).filter((i) => issueIds === "all" || issueIds.includes(i.id));
  const byGroup = new Map<string, { campaignId: string; adGroupId: string; name: string; terms: string[] }>();
  for (const i of issues) {
    const g = byGroup.get(i.target.adGroupId) ?? { campaignId: i.target.campaignId, adGroupId: i.target.adGroupId, name: i.target.adGroupName, terms: [] };
    g.terms.push(i.term);
    byGroup.set(i.target.adGroupId, g);
  }
  const diff: DiffRow[] = issues.map((i) => ({ entity: `Ad group ${i.target.adGroupName}`, field: "Add negative exact", before: null, after: `"${i.term}" (${i.target.reason})` }));
  const steps: Step[] = [...byGroup.values()].map((g) => ({ entity: `${g.terms.length} negative(s) → ${g.name}`, run: () => postAdGroupNegatives(workspaceId, g.campaignId, g.adGroupId, g.terms.map((text) => ({ text, matchType: "EXACT" as MatchType }))) }));
  return execute(workspaceId, "fixCannibalization", { issueIds }, diff, [], opts, steps);
}

function sanitize(s: string) {
  return s.replace(/[^\p{L}\p{N}]+/gu, "").slice(0, 40) || "App";
}

export function campaignName(pattern: string, parts: { app: string; country: string; matchType: string; placement?: string }) {
  return pattern
    .replaceAll("{App}", sanitize(parts.app))
    .replaceAll("{CC}", parts.country.toUpperCase())
    .replaceAll("{MatchType}", parts.matchType)
    .replaceAll("{Placement}", parts.placement ?? "SR")
    .trim()
    .slice(0, 200);
}

const MATCH_LABEL: Record<CampaignPlanInput["matchType"], string> = { EXACT: "Exact", BROAD: "Broad", SEARCH_MATCH: "SearchMatch" };

export async function planCampaigns(workspaceId: string, input: CampaignPlanInput, opts: SourceOpts = {}): Promise<CampaignPlan> {
  const warnings: string[] = [];
  let snapshot: AdsSnapshot | null = null;
  try {
    snapshot = await getSnapshot(workspaceId, { demo: opts.demo, days: 30 });
  } catch {
    snapshot = null;
  }
  const currency = snapshot?.currency ?? (await getConnection(workspaceId)).currency;
  const existingNames = new Set(snapshot?.campaigns.map((c) => c.name.toLowerCase()) ?? []);
  const countries = [...new Set(input.countries.map((c) => c.toUpperCase()))];
  if (!countries.length) throw new HttpError(400, "Choose at least one country");
  if (!(input.dailyBudget > 0) || !(input.defaultBid > 0)) throw new HttpError(400, "Budget and bid must be greater than zero");
  if (input.dailyBudget < input.defaultBid * 10) warnings.push(`A ${fmtMoney(input.dailyBudget, currency)} daily budget buys roughly ${Math.floor(input.dailyBudget / input.defaultBid)} taps at this bid. Data will come in slowly.`);
  const searchMatch = input.matchType === "SEARCH_MATCH";
  const matchType: MatchType = input.matchType === "BROAD" ? "BROAD" : "EXACT";
  const keywords = searchMatch ? [] : cleanTerms(input.keywords);
  if (searchMatch && input.keywords.length) warnings.push("Search Match campaigns run without keywords; the starter keywords were left out.");
  if (!searchMatch && !keywords.length) warnings.push("No keywords: the ad group will not serve until you add some.");
  if (input.matchType !== "EXACT") warnings.push("Discovery campaign: existing exact keywords for this app and country are added as negative exact to avoid bidding against yourself.");

  const campaigns: PlannedCampaign[] = countries.map((cc) => {
    const name = campaignName(input.namePattern, { app: input.appName, country: cc, matchType: MATCH_LABEL[input.matchType] });
    if (existingNames.has(name.toLowerCase())) warnings.push(`A campaign named ${name} already exists. Apple requires unique names.`);
    const negatives = new Set((input.negatives ?? []).map((n) => n.toLowerCase().trim()).filter(Boolean));
    if (input.matchType !== "EXACT" && snapshot) {
      const exactCampaigns = new Set(snapshot.campaigns.filter((c) => c.adamId === input.adamId && c.countries.map((x) => x.toUpperCase()).includes(cc)).map((c) => c.id));
      for (const k of snapshot.keywords) if (exactCampaigns.has(k.campaignId) && k.matchType === "EXACT" && k.status === "ACTIVE") negatives.add(k.text.toLowerCase());
    }
    return {
      name,
      country: cc,
      adamId: input.adamId,
      dailyBudget: Math.round(input.dailyBudget * 100) / 100,
      currency,
      supplySource: "APPSTORE_SEARCH_RESULTS",
      status: input.status ?? "ENABLED",
      adGroup: {
        name: name,
        defaultBid: Math.round(input.defaultBid * 100) / 100,
        searchMatch,
        keywords: keywords.map((k) => ({ text: k.text, matchType, bid: Math.round((k.bid && k.bid > 0 ? k.bid : input.defaultBid) * 100) / 100 })),
        negatives: [...negatives].map((text) => ({ text, matchType: "EXACT" as MatchType })),
      },
    };
  });
  return { campaigns, warnings };
}

function startTime() {
  return new Date(Date.now() + 5 * 60_000).toISOString().slice(0, 23);
}

export async function createCampaigns(workspaceId: string, plan: CampaignPlan, opts: WriteOpts = {}): Promise<ChangeResult> {
  const diff: DiffRow[] = [];
  const steps: Step[] = [];
  for (const p of plan.campaigns) {
    diff.push({ entity: p.name, field: "Create campaign", before: null, after: `${p.country} · ${fmtMoney(p.dailyBudget, p.currency)}/day · Search Results · ${p.status.toLowerCase()}` });
    diff.push({ entity: p.adGroup.name, field: "Create ad group", before: null, after: `Default bid ${fmtMoney(p.adGroup.defaultBid, p.currency)} · Search Match ${p.adGroup.searchMatch ? "on" : "off"}` });
    if (p.adGroup.keywords.length) diff.push({ entity: p.adGroup.name, field: "Add keywords", before: null, after: p.adGroup.keywords.map((k) => `${k.text} (${fmtMoney(k.bid, p.currency)})`).join(", ") });
    if (p.adGroup.negatives.length) diff.push({ entity: p.adGroup.name, field: "Add negative exact", before: null, after: p.adGroup.negatives.map((n) => n.text).join(", ") });
  }
  if (opts.demo || opts.dryRun) return { dryRun: true, demo: !!opts.demo, changes: diff, warnings: plan.warnings, results: [] };
  const orgId = Number(await currentOrgId(workspaceId));
  for (const p of plan.campaigns) {
    let campaignId = "";
    let adGroupId = "";
    steps.push({
      entity: `Campaign ${p.name}`,
      run: async () => {
        const c = await postCampaign(workspaceId, {
          orgId,
          name: p.name,
          adamId: p.adamId,
          countriesOrRegions: [p.country],
          dailyBudgetAmount: money(p.dailyBudget, p.currency),
          supplySources: [p.supplySource],
          adChannelType: "SEARCH",
          billingEvent: "TAPS",
          status: p.status,
        });
        campaignId = String(c.id);
      },
    });
    steps.push({
      entity: `Ad group ${p.adGroup.name}`,
      run: async () => {
        const g = await postAdGroup(workspaceId, campaignId, {
          name: p.adGroup.name,
          pricingModel: "CPC",
          defaultBidAmount: money(p.adGroup.defaultBid, p.currency),
          automatedKeywordsOptIn: p.adGroup.searchMatch,
          startTime: startTime(),
          status: "ENABLED",
        });
        adGroupId = String(g.id);
      },
    });
    if (p.adGroup.keywords.length)
      steps.push({
        entity: `${p.adGroup.keywords.length} keyword(s) → ${p.adGroup.name}`,
        run: () => postKeywords(workspaceId, campaignId, adGroupId, p.adGroup.keywords.map((k) => ({ text: k.text, matchType: k.matchType, bidAmount: money(k.bid, p.currency), status: "ACTIVE" }))),
      });
    if (p.adGroup.negatives.length)
      steps.push({ entity: `${p.adGroup.negatives.length} negative(s) → ${p.adGroup.name}`, run: () => postAdGroupNegatives(workspaceId, campaignId, adGroupId, p.adGroup.negatives) });
  }
  return execute(workspaceId, "createCampaigns", plan, diff, plan.warnings, opts, steps, true);
}

export async function createAdGroup(workspaceId: string, input: AdGroupPlanInput, opts: WriteOpts = {}): Promise<ChangeResult> {
  const ctx = await context(workspaceId, opts);
  const c = ctx.campaign(input.campaignId);
  if (!c) throw new HttpError(404, "Campaign not found");
  if (!(input.defaultBid > 0)) throw new HttpError(400, "Default bid must be greater than zero");
  const name = input.name.trim();
  if (!name) throw new HttpError(400, "Name is required");
  const warnings: string[] = [];
  if (ctx.s.adGroups.some((g) => g.campaignId === c.id && g.name.toLowerCase() === name.toLowerCase())) warnings.push(`An ad group named ${name} already exists in this campaign.`);
  if (input.searchMatch && input.matchType === "EXACT" && input.keywords.length) warnings.push("Search Match is on in a group with exact keywords. Keep discovery separate to protect bid control.");
  const keywords = cleanTerms(input.keywords);
  const diff: DiffRow[] = [
    { entity: name, field: "Create ad group", before: null, after: `in ${c.name} · default bid ${fmtMoney(input.defaultBid, c.currency)} · Search Match ${input.searchMatch ? "on" : "off"}` },
  ];
  if (keywords.length) diff.push({ entity: name, field: `Add ${input.matchType.toLowerCase()} keywords`, before: null, after: keywords.map((k) => k.text).join(", ") });
  let adGroupId = "";
  const steps: Step[] = [
    {
      entity: `Ad group ${name}`,
      run: async () => {
        const g = await postAdGroup(workspaceId, c.id, { name, pricingModel: "CPC", defaultBidAmount: money(input.defaultBid, c.currency), automatedKeywordsOptIn: input.searchMatch, startTime: startTime(), status: input.status ?? "ENABLED" });
        adGroupId = String(g.id);
      },
    },
  ];
  if (keywords.length)
    steps.push({
      entity: `${keywords.length} keyword(s) → ${name}`,
      run: () => postKeywords(workspaceId, c.id, adGroupId, keywords.map((k) => ({ text: k.text, matchType: input.matchType, status: "ACTIVE" as const, bidAmount: money(k.bid && k.bid > 0 ? k.bid : input.defaultBid, c.currency) }))),
    });
  return execute(workspaceId, "createAdGroup", input, diff, warnings, opts, steps, true);
}

export async function setCampaignStatus(workspaceId: string, campaignId: string, status: CampaignStatus, opts: WriteOpts = {}) {
  return pauseEntities(workspaceId, [{ type: "campaign", campaignId, status }], opts);
}
