import { z } from "zod";
import { analyzeKeyword, rankingsFor } from "@/lib/aso/analyze";
import { getApp, listApps } from "@/lib/aso/apps";
import { getKeyword, keywordHistory, listKeywords, type TrackedKeyword } from "@/lib/aso/keywords";
import { normalizeTerm } from "@/lib/aso/scoring";
import { compareKeywords, getCompetitor, listCompetitors } from "@/lib/competitors/competitors";
import { discoverRankingKeywords } from "@/lib/explore/ranking-keywords";
import { exploreApp, exploreSearch } from "@/lib/explore/store";
import { metadataInsights } from "@/lib/insights/metadata";
import { scoreTrackedKeywords } from "@/lib/relevance/tracked";
import { isCovered, withCoverage } from "@/lib/keywords/coverage";
import { pruneReasons } from "@/lib/keywords/prune";
import { lastScan, startScan } from "@/lib/opportunities/scan";
import { loadReviews } from "@/lib/reviews/reviews";
import { reviewThemes } from "@/lib/reviews/themes";
import { HttpError } from "@/lib/server/http";
import { startSuggestions, suggestionsOverview } from "@/lib/suggestions/run";
import { defineTool } from "../define";
import {
  appId,
  compactKeyword,
  compactStoreApp,
  country,
  countryFor,
  ESTIMATE_NOTE,
  limit,
  optionalCountry,
  topMarkets,
  trackId,
  truncate,
  waitForJob,
} from "./shared";

const JOB_WAIT_MS = 55_000;

const KEYWORD_SORTS = ["opportunity", "popularity", "difficulty", "position", "downloads", "term", "newest"] as const;

function sortKeywords(list: TrackedKeyword[], sort: (typeof KEYWORD_SORTS)[number]) {
  const num = (v: number | null, empty: number) => v ?? empty;
  const sorted = [...list];
  switch (sort) {
    case "opportunity":
      return sorted.sort((a, b) => num(b.opportunity, -1) - num(a.opportunity, -1));
    case "popularity":
      return sorted.sort((a, b) => num(b.popularity, -1) - num(a.popularity, -1));
    case "difficulty":
      return sorted.sort((a, b) => num(a.difficulty, 101) - num(b.difficulty, 101));
    case "position":
      return sorted.sort((a, b) => num(a.position, Infinity) - num(b.position, Infinity));
    case "downloads":
      return sorted.sort((a, b) => num(b.downloadsEst, -1) - num(a.downloadsEst, -1));
    case "term":
      return sorted.sort((a, b) => a.term.localeCompare(b.term));
    default:
      return sorted;
  }
}

async function resolveTrackId(workspaceId: string, input: { appId?: number; trackId?: number }) {
  if (input.trackId) return input.trackId;
  if (input.appId) return (await getApp(workspaceId, input.appId)).trackId;
  throw new HttpError(400, "Provide appId or trackId");
}

export const asoTools = [
  defineTool({
    name: "list_apps",
    title: "List tracked apps",
    layer: "aso",
    description:
      "List the apps tracked in Open ASO with their Open ASO id (appId, used by most tools), App Store trackId, primary country, tracked keyword count and whether they are linked to App Store Connect. Call this first.",
    input: {},
    run: async (_args, { workspaceId }) =>
      (await listApps(workspaceId)).map((a) => ({
        appId: a.id,
        trackId: a.trackId,
        name: a.name,
        subtitle: a.subtitle,
        developer: a.developer,
        bundleId: a.bundleId,
        primaryCountry: a.primaryCountry,
        isMine: a.isMine,
        ascLinked: !!a.ascAppId,
        keywordCount: a.keywordCount,
        keywordCountries: a.countries,
        rating: a.store.averageUserRating ?? null,
        ratingCount: a.store.userRatingCount ?? null,
        version: a.store.version ?? null,
      })),
  }),
  defineTool({
    name: "get_app_keywords",
    title: "Get tracked keywords",
    layer: "aso",
    description:
      "Tracked keywords for an app with popularity (0-100), difficulty (0-100), opportunity score, current rank (null = not in top 200), rank change, targeting label, estimated monthly downloads, relevance (0-100, core/related/unrelated/brand; languageMatch=false when the term's script doesn't fit the storefront) and metadata coverage: where the term sits in the app's own indexed metadata for that storefront (match exact/words/partial/none, strongest field title > subtitle > keywords > category, the locale, and a 0-100 indexing strength weighted title 1.0 / subtitle 0.7 / keyword field 0.45 / category 0.3, x0.8 for a secondary storefront locale). noise=true marks keywords that are not in the metadata, not ranked and off-topic (prune_keywords removes them). Use filters and fields to keep the answer small; a summary of counts is always returned.",
    input: {
      appId,
      country: optionalCountry.describe("Storefront code to filter by. Omit for all countries."),
      sort: z.enum(KEYWORD_SORTS).default("opportunity").describe("Sort order (default opportunity, highest first)"),
      ranked: z.enum(["any", "ranked", "unranked"]).default("any").describe("Keep only ranked (top 200) or unranked keywords"),
      coverage: z.enum(["any", "in-metadata", "not-in-metadata"]).default("any").describe("in-metadata = every word of the term is in the storefront's indexed title/subtitle/keyword field"),
      relevance: z.enum(["any", "relevant", "off-topic", "noise"]).default("any").describe("relevant = core/related in the right script; off-topic = unrelated/brand/wrong script; noise = off-topic, unranked and not in metadata"),
      minPopularity: z.number().int().min(0).max(100).optional(),
      fields: z.enum(["compact", "full"]).default("compact").describe("compact drops top apps, notes and timestamps"),
      limit: limit(100, 500),
    },
    run: async ({ appId: id, country: c, sort, ranked, coverage, relevance, minPopularity, fields, limit: n }, { workspaceId }) => {
      await getApp(workspaceId, id);
      let all = await listKeywords(workspaceId, id, c);
      if (all.some((k) => !k.relevanceAt)) {
        await scoreTrackedKeywords(workspaceId, id, c ?? "all").catch(() => undefined);
        all = await listKeywords(workspaceId, id, c);
      }
      const judged = (await withCoverage(workspaceId, id, all)).map((k) => ({ ...k, noise: pruneReasons(k) != null }));
      const relevant = (k: (typeof judged)[number]) => k.languageMatch && (k.relevanceCategory === "core" || k.relevanceCategory === "related" || k.relevanceCategory == null);
      const kept = judged.filter(
        (k) =>
          (ranked === "any" || (ranked === "ranked") === (k.position != null)) &&
          (coverage === "any" || (coverage === "in-metadata") === isCovered(k.coverage)) &&
          (relevance === "any" || (relevance === "noise" ? k.noise : (relevance === "relevant") === relevant(k))) &&
          (minPopularity == null || (k.popularity ?? 0) >= minPopularity),
      );
      const summary = {
        total: judged.length,
        ranked: judged.filter((k) => k.position != null).length,
        top10: judged.filter((k) => k.position != null && k.position <= 10).length,
        inMetadata: judged.filter((k) => isCovered(k.coverage)).length,
        inTitle: judged.filter((k) => isCovered(k.coverage) && k.coverage.field === "title").length,
        relevant: judged.filter(relevant).length,
        noise: judged.filter((k) => k.noise).length,
        matching: kept.length,
      };
      const rows = (sortKeywords(kept, sort) as typeof kept).slice(0, n).map((k) => {
        const base = compactKeyword(k);
        const cov = { match: k.coverage.match, field: k.coverage.field, locale: k.coverage.locale, strength: k.coverage.score, ...(k.coverage.missing.length ? { missing: k.coverage.missing } : {}) };
        if (fields === "full") return { ...base, coverage: cov, noise: k.noise };
        return {
          id: k.id,
          term: k.term,
          country: k.country,
          popularity: k.popularity,
          difficulty: k.difficulty,
          opportunity: k.opportunity,
          position: k.position,
          positionChange: k.positionChange,
          relevance: k.relevance,
          relevanceCategory: k.relevanceCategory,
          ...(k.languageMatch ? {} : { languageMatch: false }),
          coverage: cov,
          ...(k.noise ? { noise: true } : {}),
        };
      });
      return { appId: id, country: c ?? "all", summary, note: ESTIMATE_NOTE, keywords: rows };
    },
  }),
  defineTool({
    name: "search_rankings",
    title: "Check rankings for terms",
    layer: "aso",
    description:
      "Check where an app currently ranks (top 200) in App Store search for up to 20 terms in one or several storefronts (up to 10 countries in one call). Live lookup; does not save anything.",
    input: {
      appId: appId.optional(),
      trackId: trackId.optional(),
      terms: z.array(z.string().trim().min(1).max(100)).min(1).max(20).describe("Search terms to check"),
      country: country.optional().describe("One storefront code"),
      countries: z.array(country).min(1).max(10).optional().describe("Several storefront codes; use instead of country"),
    },
    run: async (input, { workspaceId }) => {
      const id = await resolveTrackId(workspaceId, input);
      const list = [...new Set(input.countries ?? (input.country ? [input.country] : []))];
      if (!list.length) throw new HttpError(400, "Provide country or countries");
      const results = await Promise.all(list.map(async (c) => ({ country: c, rankings: await rankingsFor(id, input.terms, c) })));
      return list.length === 1 && !input.countries ? { trackId: id, country: list[0], rankings: results[0].rankings } : { trackId: id, results };
    },
  }),
  defineTool({
    name: "analyze_keyword",
    title: "Analyze a keyword",
    layer: "aso",
    description:
      "Full analysis of one search term in one storefront: popularity, difficulty (with breakdown), opportunity, estimated monthly searches and downloads, targeting label, the top 10 ranking apps and, when trackId is given, that app's rank.",
    input: { term: z.string().trim().min(1).max(100), country, trackId: trackId.optional().describe("Optional App Store id whose rank to report") },
    run: async ({ term, country: c, trackId: t }, { workspaceId }) => ({ ...(await analyzeKeyword(term, c, t, workspaceId)), note: ESTIMATE_NOTE }),
  }),
  defineTool({
    name: "search_app_store",
    title: "Search the App Store",
    layer: "aso",
    description: "Search the public App Store like a user would and return results in rank order. Accepts a search term, an App Store URL or a numeric app id.",
    input: { term: z.string().trim().min(1).max(200), country, limit: limit(25, 60) },
    run: async ({ term, country: c, limit: n }) => {
      const results = await exploreSearch(term, c);
      return { term, country: c, count: results.length, results: results.slice(0, n).map((a, i) => compactStoreApp(a, i + 1)) };
    },
  }),
  defineTool({
    name: "get_app_details",
    title: "Get app details",
    layer: "aso",
    description: "Public App Store details for any app (rating, genre, price, version, size, languages, short description) plus modeled monthly download and revenue estimates.",
    input: { trackId, country },
    run: async ({ trackId: t, country: c }, { workspaceId }) => {
      const d = await exploreApp(workspaceId, t, c);
      return {
        ...compactStoreApp(d.app),
        description: truncate(d.app.description, 800),
        contentRating: d.app.contentAdvisoryRating,
        minimumOsVersion: d.app.minimumOsVersion ?? null,
        fileSizeBytes: d.app.fileSizeBytes ?? null,
        languages: d.app.languageCodesISO2A ?? [],
        country: d.country,
        downloadsEstimate: d.downloadsEst,
        revenueEstimate: d.revenueEst,
        trackedAppId: d.trackedAppId,
        note: ESTIMATE_NOTE,
      };
    },
  }),
  defineTool({
    name: "get_ranking_keywords",
    title: "Discover ranking keywords",
    layer: "aso",
    description:
      "Discover search terms an app already ranks for in a storefront, derived from its title, subtitle, description and search hints and verified against live search results. Works for any app, including competitors.",
    input: { trackId, country },
    run: async ({ trackId: t, country: c }) => ({ trackId: t, country: c, keywords: await discoverRankingKeywords(t, c) }),
  }),
  defineTool({
    name: "list_competitors",
    title: "List competitors",
    layer: "aso",
    description:
      "Competitors saved for an app with live rating, version, estimated downloads/revenue, how many tracked keywords they share and how many of those they outrank the app on. Use the competitor id with get_competitor_comparison.",
    input: { appId, country: optionalCountry },
    run: async ({ appId: id, country: c }, { workspaceId }) => {
      const code = await countryFor(workspaceId, id, c);
      return { appId: id, country: code, note: ESTIMATE_NOTE, competitors: await listCompetitors(workspaceId, id, code) };
    },
  }),
  defineTool({
    name: "get_competitor_comparison",
    title: "Compare with a competitor",
    layer: "aso",
    description:
      "Keyword-by-keyword rank comparison between an app and one saved competitor across the app's tracked keywords, with counts of where each side leads and keywords only the competitor ranks for.",
    input: { competitorId: z.number().int().positive().describe("Competitor id from list_competitors"), country: optionalCountry },
    run: async ({ competitorId, country: c }, { workspaceId }) => {
      const competitor = await getCompetitor(workspaceId, competitorId, c);
      const comparison = await compareKeywords(workspaceId, competitorId, c ?? (await getApp(workspaceId, competitor.appId)).primaryCountry);
      return { competitor: { id: competitor.id, appId: competitor.appId, trackId: competitor.trackId, name: competitor.name }, ...comparison };
    },
  }),
  defineTool({
    name: "get_keyword_history",
    title: "Keyword history",
    layer: "aso",
    description: "Daily history (popularity, difficulty, rank) for one tracked keyword. Keyword ids come from get_app_keywords.",
    input: { keywordId: z.number().int().positive() },
    run: async ({ keywordId }, { workspaceId }) => {
      const k = await getKeyword(workspaceId, keywordId);
      return { keyword: { id: k.id, appId: k.appId, term: k.term, country: k.country, position: k.position }, history: await keywordHistory(workspaceId, keywordId) };
    },
  }),
  defineTool({
    name: "get_keyword_suggestions",
    title: "Keyword suggestions",
    layer: "aso",
    description:
      "New keyword ideas for an app, judged for relevance to the app (Jev, or a heuristic fallback; unrelated/brand/wrong-language ideas are dropped) and scored by popularity, difficulty and opportunity; sorted by score = relevance x opportunity. Returns the last generated set when available; otherwise (or with refresh: true) starts generation and waits up to ~55s. If still running, call again later. Requires at least 3 tracked keywords in the country.",
    input: {
      appId,
      country: optionalCountry,
      refresh: z.boolean().default(false).describe("Generate a fresh set instead of returning the cached one"),
      useAi: z.boolean().default(true).describe("Include AI ideas when an Anthropic key is configured"),
      limit: limit(40, 100),
    },
    run: async ({ appId: id, country: c, refresh, useAi, limit: n }, { workspaceId }) => {
      const code = await countryFor(workspaceId, id, c);
      const overview = await suggestionsOverview(workspaceId, id, code);
      let result = overview.last;
      if (!result || refresh) {
        const outcome = await waitForJob(await startSuggestions(workspaceId, id, code, useAi), JOB_WAIT_MS);
        if (!outcome.done) return { status: "running", message: "Still generating suggestions. Call get_keyword_suggestions again in a minute (refresh: false).", job: outcome.job };
        result = outcome.result;
      }
      return { status: "done", note: ESTIMATE_NOTE, ...result, suggestions: result.suggestions.slice(0, n), filtered: (result.filtered ?? []).slice(0, 20) };
    },
  }),
  defineTool({
    name: "get_metadata_insights",
    title: "Metadata insights",
    layer: "aso",
    description:
      "Actionable findings about an app's title and subtitle versus its tracked keywords: unused characters, duplicated words, high-opportunity keywords missing from the title/subtitle, and keywords that are working.",
    input: { appId, country: optionalCountry },
    run: async ({ appId: id, country: c }, { workspaceId }) => metadataInsights(workspaceId, id, await countryFor(workspaceId, id, c)),
  }),
  defineTool({
    name: "get_country_opportunities",
    title: "Country opportunities",
    layer: "aso",
    description:
      "Scan one keyword across many storefronts to find countries where it is popular but less competitive, including the app's rank in each. Defaults to the 20 largest markets. Waits up to ~55s; if still running, call again with the same arguments.",
    input: {
      appId,
      term: z.string().trim().min(1).max(100),
      countries: z.array(country).min(1).max(66).optional().describe("Storefront codes to scan (default: 20 largest markets)"),
    },
    run: async ({ appId: id, term, countries }, { workspaceId }) => {
      await getApp(workspaceId, id);
      const list = countries ?? topMarkets(20);
      const outcome = await waitForJob(await startScan(workspaceId, id, term, list), JOB_WAIT_MS);
      if (!outcome.done) {
        const last = (await lastScan(workspaceId, id)).last;
        return { status: "running", message: "Scan still running. Call again with the same arguments in a minute.", job: outcome.job, previous: last && last.term === normalizeTerm(term) ? last : null };
      }
      return { status: "done", note: ESTIMATE_NOTE, ...outcome.result };
    },
  }),
  defineTool({
    name: "get_reviews",
    title: "Get reviews",
    layer: "aso",
    description:
      "Recent public App Store reviews for an app in one storefront (or 'all' for the 10 largest), newest first, optionally filtered by star rating, with a rating histogram and recurring positive/negative phrases.",
    input: {
      trackId,
      country: z
        .string()
        .trim()
        .toLowerCase()
        .refine((v) => v === "all" || country.safeParse(v).success, "Unsupported storefront country code")
        .describe("Two-letter storefront code, or 'all' for the 10 largest storefronts"),
      minRating: z.number().int().min(1).max(5).optional(),
      maxRating: z.number().int().min(1).max(5).optional(),
      limit: limit(50, 200),
    },
    run: async ({ trackId: t, country: c, minRating, maxRating, limit: n }) => {
      const data = await loadReviews(t, c);
      const filtered = data.reviews.filter((r) => (minRating == null || r.rating >= minRating) && (maxRating == null || r.rating <= maxRating));
      const histogram = [1, 2, 3, 4, 5].map((stars) => ({ stars, count: data.reviews.filter((r) => r.rating === stars).length }));
      const themes = reviewThemes(data.reviews, "", 8);
      return {
        trackId: t,
        scope: c,
        countries: data.countries,
        totalFetched: data.reviews.length,
        matching: filtered.length,
        histogram,
        themes: { negative: themes.negative, positive: themes.positive },
        reviews: filtered.slice(0, n).map((r) => ({ rating: r.rating, title: r.title, content: truncate(r.content, 600), version: r.version, date: r.updated, country: r.country, author: r.author })),
      };
    },
  }),
];
