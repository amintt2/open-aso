import { z } from "zod";
import { getConnection } from "@/lib/apple-ads/connection";
import { BID_RULES, diagnoseKeyword, FORMULAS, GUARDRAILS, REVIEW_CHECKLIST, SAFE_DEFAULTS, suggestBid, type BidRow } from "@/lib/apple-ads/knowledge";
import {
  addKeywords,
  addNegativeKeywords,
  createCampaigns,
  getDashboard,
  getKeywordTrend,
  getPerformance,
  getSnapshot,
  getTargetCpa,
  listCampaigns,
  pauseEntities,
  planCampaigns,
  updateBids,
  updateBudgets,
} from "@/lib/apple-ads/service";
import type { AdsSnapshot, CampaignPlanInput, ChangeResult, EntityStatusChange, RangeDays } from "@/lib/apple-ads/types";
import { HttpError } from "@/lib/server/http";
import { defineTool } from "../define";
import { confirm, dryRun, shouldApply } from "./shared";

const days = z
  .union([z.literal(7), z.literal(14), z.literal(30), z.literal(90)])
  .default(30)
  .describe("Reporting window in days: 7, 14, 30 or 90 (default 30)");
const demo = z.boolean().default(false).describe("Use built-in demo data instead of the connected account");
const demoPreview = z.boolean().default(false).describe("Preview against demo data (always a dry run)");
const id = z.union([z.string().regex(/^\d+$/), z.number().int().positive()]).transform(String);
const money = z.number().positive().max(100_000);

const MCP_GUARDS = [
  "Every write is a dry run unless dryRun: false and confirm: true are both sent, and the user enabled write tools in Open ASO.",
  "Only exact match keywords and exact negatives can be added over MCP.",
  "Budget updates are rejected when they raise a campaign budget more than 30% in one call or exceed the maxDailyBudget you pass.",
  "Bid updates are capped at ±30% per change and rejected above the maxBid you pass.",
  "Campaigns created over MCP start paused unless status: ENABLED is requested.",
  "Pausing is available; re-enabling paused entities is not.",
];

function withMode(result: ChangeResult, applied: boolean) {
  return {
    ...result,
    applied,
    message: applied
      ? "Applied. Check results for per-entity success."
      : result.changes.length
        ? "Dry run. Show this diff to the user; apply only after explicit approval with dryRun: false and confirm: true."
        : "Nothing to change.",
  };
}

function findKeyword(s: AdsSnapshot, keywordId: string) {
  const k = s.keywords.find((x) => x.id === keywordId);
  if (!k) throw new HttpError(404, `Keyword ${keywordId} not found in the last 30 days of data`);
  return k;
}

export const adsTools = [
  defineTool({
    name: "get_apple_ads_connection",
    title: "Apple Ads connection",
    layer: "ads",
    description: "Whether an Apple Ads account is connected, which organization and currency it uses, the last error and the target CPA used for bid decisions. Check this before other Apple Ads tools; demo: true works without a connection.",
    input: {},
    run: () => {
      const c = getConnection();
      return { configured: c.configured, connected: c.connected, orgId: c.orgId, orgName: c.orgName, currency: c.currency, lastError: c.lastError, lastCheckedAt: c.lastCheckedAt, targetCpa: getTargetCpa() };
    },
  }),
  defineTool({
    name: "list_apple_ads_campaigns",
    title: "List Apple Ads campaigns",
    layer: "ads",
    description: "Apple Ads campaigns with status, serving state, countries, daily budget, budget utilization and metrics (impressions, taps, installs, spend, TTR, CR, CPT, CPA) plus attributed revenue when available.",
    input: { days, demo },
    run: async ({ days: d, demo: isDemo }) =>
      (await listCampaigns({ days: d as RangeDays, demo: isDemo })).map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        displayStatus: c.displayStatus,
        servingStateReasons: c.servingStateReasons,
        adamId: c.adamId,
        countries: c.countries,
        dailyBudget: c.dailyBudget,
        currency: c.currency,
        budgetUtilization: c.budgetUtilization,
        metrics: c.metrics,
        attribution: c.attribution,
      })),
  }),
  defineTool({
    name: "get_apple_ads_performance",
    title: "Apple Ads performance",
    layer: "ads",
    description: "Account performance for a window: totals vs the previous period, attribution (revenue, ROAS), per-campaign metrics, the top 25 keywords by spend with diagnosis, bid and budget suggestions and cannibalization issues.",
    input: { days, demo },
    run: ({ days: d, demo: isDemo }) => getPerformance({ days: d as RangeDays, demo: isDemo }),
  }),
  defineTool({
    name: "get_apple_ads_keyword_trend",
    title: "Apple Ads keyword trend",
    layer: "ads",
    description: "Daily impressions, taps, installs, spend, CPT and CPA for one Apple Ads keyword (keyword id from get_apple_ads_performance).",
    input: { keywordId: id, demo },
    run: ({ keywordId, demo: isDemo }) => getKeywordTrend(keywordId, { demo: isDemo }),
  }),
  defineTool({
    name: "get_apple_ads_playbook",
    title: "Apple Ads playbook",
    layer: "ads",
    description: "The rules Open ASO uses to manage Apple Ads: metric formulas, safe structural defaults, bid decision rules, numeric guardrails, a daily/weekly/monthly review checklist and the extra limits enforced on MCP writes. Read before proposing changes.",
    input: {},
    run: () => ({ formulas: FORMULAS, safeDefaults: SAFE_DEFAULTS, bidRules: BID_RULES, guardrails: GUARDRAILS, reviewChecklist: REVIEW_CHECKLIST, mcpGuards: MCP_GUARDS }),
  }),
  defineTool({
    name: "diagnose_apple_ads_keyword",
    title: "Diagnose an Apple Ads keyword",
    layer: "ads",
    description:
      "Diagnose one keyword with the playbook rules (raise / lower / hold / pause / wait / review) and propose a capped bid. Pass keywordId to use live data, or pass raw metrics (impressions, taps, installs, spend, bid, days) for a what-if.",
    input: {
      keywordId: id.optional(),
      demo,
      metrics: z
        .object({
          impressions: z.number().int().min(0),
          taps: z.number().int().min(0),
          installs: z.number().int().min(0),
          spend: z.number().min(0),
          bid: z.number().positive(),
          days: z.number().int().positive(),
          suggestedBid: z.number().positive().nullable().optional(),
          impressionShare: z.number().min(0).max(1).nullable().optional(),
          revenue: z.number().min(0).nullable().optional(),
          attributedInstalls: z.number().int().min(0).nullable().optional(),
          targetCpa: z.number().positive().nullable().optional(),
        })
        .optional()
        .describe("Raw metrics for a what-if diagnosis when keywordId is not given"),
    },
    run: async ({ keywordId, demo: isDemo, metrics }) => {
      if (keywordId) {
        const s = await getSnapshot({ demo: isDemo, days: 30 });
        const k = findKeyword(s, keywordId);
        return { keywordId: k.id, text: k.text, matchType: k.matchType, status: k.status, bid: k.bid, suggestedBid: k.suggestedBid, impressionShare: k.impressionShare, metrics: k.metrics, attribution: k.attribution, diagnosis: k.diagnosis, suggestion: k.suggestion };
      }
      if (!metrics) throw new HttpError(400, "Provide keywordId or metrics");
      const signal = { ...metrics, targetCpa: metrics.targetCpa ?? getTargetCpa() };
      const diagnosis = diagnoseKeyword(signal);
      const row: BidRow = { ...signal, keywordId: "what-if", campaignId: "", adGroupId: "", text: "what-if" };
      const suggestion = suggestBid(row, diagnosis);
      return { diagnosis, suggestedBid: suggestion?.suggested ?? null, changePct: suggestion?.changePct ?? null, capped: suggestion?.capped ?? false };
    },
  }),
  defineTool({
    name: "suggest_bid_changes",
    title: "Suggest bid and budget changes",
    layer: "ads",
    description: "Bid suggestions (capped at ±30%) for keywords with enough data and budget suggestions for capped or overspending campaigns, each with the rule and reason. Feed approved rows into update_apple_ads_bids / update_apple_ads_budgets.",
    input: { days, demo, campaignId: id.optional().describe("Limit to one campaign") },
    run: async ({ days: d, demo: isDemo, campaignId }) => {
      const dash = await getDashboard({ days: d as RangeDays, demo: isDemo });
      const match = <T extends { campaignId: string }>(rows: T[]) => (campaignId ? rows.filter((r) => r.campaignId === campaignId) : rows);
      return { demo: dash.demo, currency: dash.currency, days: dash.days, targetCpa: dash.targetCpa, bidSuggestions: match(dash.bidSuggestions), budgetSuggestions: match(dash.budgetSuggestions), cannibalization: dash.cannibalization };
    },
  }),
  ...planningTools(),
  defineTool({
    name: "update_apple_ads_bids",
    title: "Update Apple Ads bids",
    layer: "ads",
    write: true,
    description:
      "Change max CPT bids of existing keywords. Each change is capped at ±30% of the current bid and must not exceed maxBid. Dry run by default (returns a before/after diff); apply only after user approval with dryRun: false and confirm: true.",
    input: {
      changes: z.array(z.object({ campaignId: id, adGroupId: id, keywordId: id, bid: money })).min(1).max(100),
      maxBid: money.describe("Hard ceiling for any new bid in account currency"),
      dryRun,
      confirm,
      demo: demoPreview,
    },
    run: async ({ changes, maxBid, dryRun: dr, confirm: cf, demo: isDemo }) => {
      const over = changes.filter((c) => c.bid > maxBid);
      if (over.length) throw new HttpError(400, `Bids above maxBid ${maxBid}: ${over.map((c) => `${c.keywordId}→${c.bid}`).join(", ")}`);
      const s = await getSnapshot({ days: 30, demo: isDemo });
      for (const c of changes) {
        const k = findKeyword(s, c.keywordId);
        if (k.campaignId !== c.campaignId || k.adGroupId !== c.adGroupId) throw new HttpError(400, `Keyword ${c.keywordId} belongs to campaign ${k.campaignId} / ad group ${k.adGroupId}`);
      }
      const apply = !isDemo && shouldApply({ dryRun: dr, confirm: cf });
      return withMode(await updateBids(changes, { dryRun: !apply, demo: isDemo, enforceCaps: true }), apply);
    },
  }),
  defineTool({
    name: "update_apple_ads_budgets",
    title: "Update Apple Ads budgets",
    layer: "ads",
    write: true,
    description:
      "Change campaign daily budgets. Rejected when any budget rises more than 30% above its current value in one call or exceeds maxDailyBudget. Dry run by default; apply only after user approval with dryRun: false and confirm: true.",
    input: {
      changes: z.array(z.object({ campaignId: id, dailyBudget: money })).min(1).max(50),
      maxDailyBudget: money.describe("Hard ceiling for any campaign daily budget in account currency"),
      dryRun,
      confirm,
      demo: demoPreview,
    },
    run: async ({ changes, maxDailyBudget, dryRun: dr, confirm: cf, demo: isDemo }) => {
      const campaigns = new Map((await listCampaigns({ days: 30, demo: isDemo })).map((c) => [c.id, c]));
      const problems: string[] = [];
      for (const ch of changes) {
        const c = campaigns.get(ch.campaignId);
        if (!c) problems.push(`campaign ${ch.campaignId} not found`);
        else if (c.dailyBudget == null) problems.push(`${c.name} has no daily budget to compare against`);
        else if (ch.dailyBudget > c.dailyBudget * (1 + GUARDRAILS.maxBudgetIncrease) + 1e-9) problems.push(`${c.name}: ${c.dailyBudget} → ${ch.dailyBudget} is more than +30%`);
        if (ch.dailyBudget > maxDailyBudget) problems.push(`${c?.name ?? ch.campaignId}: ${ch.dailyBudget} exceeds maxDailyBudget ${maxDailyBudget}`);
      }
      if (problems.length) throw new HttpError(400, `Budget change blocked: ${problems.join("; ")}`);
      const apply = !isDemo && shouldApply({ dryRun: dr, confirm: cf });
      return withMode(await updateBudgets(changes, { dryRun: !apply, demo: isDemo }), apply);
    },
  }),
  defineTool({
    name: "pause_apple_ads_entities",
    title: "Pause campaigns, ad groups or keywords",
    layer: "ads",
    write: true,
    description: "Pause Apple Ads campaigns, ad groups or keywords. Re-enabling is not available over MCP. Dry run by default; apply only after user approval with dryRun: false and confirm: true.",
    input: {
      entities: z
        .array(
          z.discriminatedUnion("type", [
            z.object({ type: z.literal("campaign"), campaignId: id }),
            z.object({ type: z.literal("adgroup"), campaignId: id, adGroupId: id }),
            z.object({ type: z.literal("keyword"), campaignId: id, adGroupId: id, keywordId: id }),
          ]),
        )
        .min(1)
        .max(100),
      dryRun,
      confirm,
      demo: demoPreview,
    },
    run: async ({ entities, dryRun: dr, confirm: cf, demo: isDemo }) => {
      const list: EntityStatusChange[] = entities.map((e) => ({ ...e, status: "PAUSED" as const }));
      const apply = !isDemo && shouldApply({ dryRun: dr, confirm: cf });
      return withMode(await pauseEntities(list, { dryRun: !apply, demo: isDemo }), apply);
    },
  }),
  defineTool({
    name: "add_apple_ads_keywords",
    title: "Add Apple Ads keywords",
    layer: "ads",
    write: true,
    description:
      "Add exact match keywords to an ad group. Bids default to the ad group default bid; every bid must be ≤ maxBid. Duplicates are skipped. Dry run by default; apply only after user approval with dryRun: false and confirm: true.",
    input: {
      campaignId: id,
      adGroupId: id,
      keywords: z.array(z.object({ text: z.string().trim().min(1).max(80), bid: money.optional() })).min(1).max(100),
      maxBid: money.describe("Hard ceiling for any keyword bid in account currency"),
      dryRun,
      confirm,
      demo: demoPreview,
    },
    run: async ({ campaignId, adGroupId, keywords, maxBid, dryRun: dr, confirm: cf, demo: isDemo }) => {
      const s = await getSnapshot({ days: 30, demo: isDemo });
      const group = s.adGroups.find((g) => g.id === adGroupId && g.campaignId === campaignId);
      if (!group) throw new HttpError(404, `Ad group ${adGroupId} not found in campaign ${campaignId}`);
      const over = keywords.filter((k) => (k.bid ?? group.defaultBid) > maxBid);
      if (over.length) throw new HttpError(400, `Bids above maxBid ${maxBid}: ${over.map((k) => `"${k.text}" ${k.bid ?? group.defaultBid}`).join(", ")}`);
      const apply = !isDemo && shouldApply({ dryRun: dr, confirm: cf });
      return withMode(await addKeywords({ campaignId, adGroupId, keywords: keywords.map((k) => ({ text: k.text, bid: k.bid ?? null, matchType: "EXACT" as const })) }, { dryRun: !apply, demo: isDemo }), apply);
    },
  }),
  defineTool({
    name: "add_negative_keywords",
    title: "Add negative keywords",
    layer: "ads",
    write: true,
    description: "Add exact match negative keywords to a campaign, or to one ad group when adGroupId is given. Warns when a negative would block an active keyword. Dry run by default; apply only after user approval with dryRun: false and confirm: true.",
    input: {
      campaignId: id,
      adGroupId: id.optional(),
      keywords: z.array(z.string().trim().min(1).max(80)).min(1).max(200),
      dryRun,
      confirm,
      demo: demoPreview,
    },
    run: async ({ campaignId, adGroupId, keywords, dryRun: dr, confirm: cf, demo: isDemo }) => {
      const apply = !isDemo && shouldApply({ dryRun: dr, confirm: cf });
      return withMode(await addNegativeKeywords({ campaignId, adGroupId: adGroupId ?? null, keywords: keywords.map((text) => ({ text, matchType: "EXACT" as const })) }, { dryRun: !apply, demo: isDemo }), apply);
    },
  }),
];

function planInput() {
  return {
    adamId: z.number().int().positive().describe("App Store id (trackId) of the app to promote"),
    appName: z.string().trim().min(1).max(60).describe("Short app name used in campaign names"),
    countries: z.array(z.string().trim().length(2)).min(1).max(20).describe("Two-letter country codes; one campaign per country"),
    dailyBudget: money.describe("Daily budget per campaign in account currency"),
    defaultBid: money.describe("Default max CPT bid in account currency"),
    keywords: z.array(z.object({ text: z.string().trim().min(1).max(80), bid: money.optional() })).max(200).default([]).describe("Exact match keywords"),
    negatives: z.array(z.string().trim().min(1).max(80)).max(200).optional(),
    namePattern: z.string().trim().min(1).max(120).default("{App} - {CC} - {MatchType}").describe("Placeholders: {App}, {CC}, {MatchType}, {Placement}"),
    status: z.enum(["ENABLED", "PAUSED"]).default("PAUSED").describe("Initial status (default PAUSED)"),
  };
}

type PlanArgs = { adamId: number; appName: string; countries: string[]; dailyBudget: number; defaultBid: number; keywords: { text: string; bid?: number }[]; negatives?: string[]; namePattern: string; status: "ENABLED" | "PAUSED" };

function toPlanInput(a: PlanArgs): CampaignPlanInput {
  return { ...a, matchType: "EXACT", keywords: a.keywords.map((k) => ({ text: k.text, bid: k.bid ?? null })) };
}

function planningTools() {
  return [
    defineTool({
      name: "plan_apple_ads_campaigns",
      title: "Plan Apple Ads campaigns",
      layer: "ads",
      description: "Build a structured plan of exact match Search Results campaigns (one per country, one ad group each) with names, budgets, bids, keywords and warnings, without changing anything. Review it, then pass the same arguments to create_apple_ads_campaigns.",
      input: { ...planInput(), demo },
      run: ({ demo: isDemo, ...args }) => planCampaigns(toPlanInput(args), { demo: isDemo }),
    }),
    defineTool({
      name: "create_apple_ads_campaigns",
      title: "Create Apple Ads campaigns",
      layer: "ads",
      write: true,
      description:
        "Create the exact match campaigns described by plan_apple_ads_campaigns (paused by default). Requires maxDailyBudget, which the per-campaign daily budget may not exceed. Dry run by default; apply only after user approval with dryRun: false and confirm: true.",
      input: { ...planInput(), maxDailyBudget: money.describe("Hard ceiling for each campaign's daily budget"), dryRun, confirm, demo: demoPreview },
      run: async ({ maxDailyBudget, dryRun: dr, confirm: cf, demo: isDemo, ...args }) => {
        if (args.dailyBudget > maxDailyBudget) throw new HttpError(400, `dailyBudget ${args.dailyBudget} exceeds maxDailyBudget ${maxDailyBudget}`);
        const plan = await planCampaigns(toPlanInput(args), { demo: isDemo });
        const apply = !isDemo && shouldApply({ dryRun: dr, confirm: cf });
        return { plan, ...withMode(await createCampaigns(plan, { dryRun: !apply, demo: isDemo }), apply) };
      },
    }),
  ];
}
