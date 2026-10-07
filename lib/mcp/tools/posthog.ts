import { z } from "zod";
import {
  getPosthogEvents,
  getPosthogExperiments,
  getPosthogFunnel,
  getPosthogGeography,
  getPosthogNewUsers,
  getPosthogOverview,
  getPosthogRetention,
  getPosthogVersions,
  type PosthogQuery,
} from "@/lib/posthog/queries";
import { getApp } from "@/lib/aso/apps";
import { defineTool } from "../define";

const input = {
  appId: z.number().int().positive().describe("Open ASO app id from list_apps. The app must be mapped to PostHog in Integrations."),
  days: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(30).describe("Window in days: 7, 30 or 90 (default 30)"),
  refresh: z.boolean().default(false).describe("Bypass the 10-minute cache"),
};

type Args = { appId: number; days: number; refresh: boolean };

function query(a: Args): PosthogQuery {
  getApp(a.appId);
  return { appId: a.appId, days: a.days, refresh: a.refresh };
}

export const posthogTools = [
  defineTool({
    name: "get_posthog_overview",
    title: "PostHog overview",
    layer: "analytics",
    description: "Product analytics from PostHog for one app: new users, DAU/WAU and events per day versus the previous window, plus the top events with counts and unique users.",
    input,
    run: (a) => getPosthogOverview(query(a)),
  }),
  defineTool({
    name: "get_posthog_funnel",
    title: "PostHog funnel",
    layer: "analytics",
    description: "Ordered per-user funnel from PostHog: first open → onboarding started → onboarding completed → paywall viewed → purchase started → purchase success, with conversion and drop-off per step and the purchase-cancel rate. Steps without mapped events are reported as missing.",
    input,
    run: (a) => getPosthogFunnel(query(a)),
  }),
  defineTool({
    name: "get_posthog_retention",
    title: "PostHog retention",
    layer: "analytics",
    description: "D1/D7/D30 retention cohorts from PostHog based on first open and app-open events.",
    input,
    run: (a) => getPosthogRetention(query(a)),
  }),
  defineTool({
    name: "get_posthog_geography",
    title: "PostHog geography",
    layer: "analytics",
    description: "New and active users by country (GeoIP) and top cities from PostHog. Useful next to keyword rankings per storefront.",
    input,
    run: (a) => getPosthogGeography(query(a)),
  }),
  defineTool({
    name: "get_posthog_versions",
    title: "PostHog app versions",
    layer: "analytics",
    description: "Users, new users and events per app version from PostHog, with App Store release dates when known.",
    input,
    run: (a) => getPosthogVersions(query(a)),
  }),
  defineTool({
    name: "get_posthog_experiments",
    title: "PostHog experiments",
    layer: "analytics",
    description: "Feature flag / experiment exposures by flag and variant with downstream paywall-view and purchase-success rates per variant.",
    input,
    run: (a) => getPosthogExperiments(query(a)),
  }),
  defineTool({
    name: "get_posthog_new_users",
    title: "PostHog new users",
    layer: "analytics",
    description: "Daily new users (first opens) from PostHog for one app, optionally filtered to one storefront country (ISO alpha-2), to compare against keyword ranking changes.",
    input: { ...input, country: z.string().length(2).optional().describe("ISO country code, e.g. us, fr") },
    run: (a) => getPosthogNewUsers(query(a), a.country ?? null),
  }),
  defineTool({
    name: "get_posthog_events",
    title: "PostHog live events",
    layer: "analytics",
    description: "The last 100 PostHog events for one app (time, event, user, SDK, country, version) from the past 7 days.",
    input: { appId: input.appId, refresh: input.refresh },
    run: (a) => getPosthogEvents({ appId: a.appId, days: 7, refresh: a.refresh }),
  }),
];
