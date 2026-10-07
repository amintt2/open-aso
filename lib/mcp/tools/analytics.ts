import { z } from "zod";
import { getGeography, getKeywordRoas, getOverview, getRetention, getSources } from "@/lib/analytics/queries";
import type { AnalyticsQuery } from "@/lib/analytics/types";
import { getApp } from "@/lib/aso/apps";
import { defineTool } from "../define";

const input = {
  appId: z.number().int().positive().optional().describe("Open ASO app id from list_apps. Omit for all apps."),
  days: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(30).describe("Window in days: 7, 30 or 90 (default 30)"),
  includeSandbox: z.boolean().default(false).describe("Include sandbox (test) purchases"),
  demo: z.enum(["never", "auto", "only"]).default("never").describe("never = real data only (default), auto = demo data when nothing is recorded yet, only = demo data"),
};

type Args = { appId?: number; days: number; includeSandbox: boolean; demo: "never" | "auto" | "only" };

async function query(workspaceId: string, a: Args): Promise<AnalyticsQuery> {
  if (a.appId) await getApp(workspaceId, a.appId);
  return { appId: a.appId ?? null, days: a.days, includeSandbox: a.includeSandbox, demo: a.demo };
}

export const analyticsTools = [
  defineTool({
    name: "get_analytics_overview",
    title: "Analytics overview",
    layer: "analytics",
    description: "Installs, trials, purchases, gross/net revenue, refunds, paying users and trial conversion for a window versus the previous window, plus a daily series. Data comes from the Open ASO SDK and RevenueCat/Superwall webhooks.",
    input,
    run: async (a, { workspaceId }) => getOverview(workspaceId, await query(workspaceId, a)),
  }),
  defineTool({
    name: "get_analytics_sources",
    title: "Install sources",
    layer: "analytics",
    description: "Installs, trials, payers, revenue, trial rate and conversion split by source (Apple Ads vs organic), with Apple Ads campaign breakdown when attribution is available.",
    input,
    run: async (a, { workspaceId }) => getSources(workspaceId, await query(workspaceId, a)),
  }),
  defineTool({
    name: "get_analytics_geography",
    title: "Geography",
    layer: "analytics",
    description: "Installs, trials, payers, revenue and revenue per install by country, plus top cities.",
    input,
    run: async (a, { workspaceId }) => getGeography(workspaceId, await query(workspaceId, a)),
  }),
  defineTool({
    name: "get_analytics_retention",
    title: "Retention",
    layer: "analytics",
    description: "Install cohorts with day 1, day 7 and day 30 retention (share of users active again) and the averages across cohorts.",
    input,
    run: async (a, { workspaceId }) => getRetention(workspaceId, await query(workspaceId, a)),
  }),
  defineTool({
    name: "get_keyword_roas",
    title: "Keyword ROAS",
    layer: "analytics",
    description: "Per Apple Ads keyword: spend, taps, Apple-reported and SDK-attributed installs, trials, payers, revenue, CPI, trial rate and ROAS, plus totals. Use it to decide which keywords earn back their spend.",
    input,
    run: async (a, { workspaceId }) => getKeywordRoas(workspaceId, await query(workspaceId, a)),
  }),
];
