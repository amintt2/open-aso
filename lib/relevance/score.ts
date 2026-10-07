import { createHash } from "node:crypto";
import { getCountry, isCountry } from "@/lib/appstore/countries";
import { getApp, type TrackedApp } from "@/lib/aso/apps";
import { listKeywords, type TrackedKeyword } from "@/lib/aso/keywords";
import { normalizeTerm } from "@/lib/aso/scoring";
import { isTypesafeConfigured, typesafeChoices, TypesafeError, typesafeModel, type TypesafeOptions } from "@/lib/ai/typesafe";
import { cacheGetMany, cacheSetMany, DAY, wsKey } from "@/lib/server/cache";
import { db } from "@/lib/server/db";
import { mapLimit } from "@/lib/suggestions/jobs";
import { segments } from "@/lib/suggestions/text";
import { buildVocabulary, heuristicScore, type Vocabulary } from "./heuristic";
import { languageMatches, searchLanguages } from "./language";
import type { Relevance, RelevanceCategory, RelevanceStatus } from "./types";

const BATCH = 60;
const PARALLEL = 4;
const TTL = 30 * DAY;
const DESCRIPTION_CHARS = 1500;
const TRACKED_IN_STATE = 30;
const RELATED_WEIGHT = 0.55;
const MIN_RELATED = 50;
const KEY_VERSION = "v2";

const CRITERIA: Record<RelevanceCategory, string> = {
  core: "describes the app's main purpose or a core feature; a searcher would likely install this app",
  related: "an adjacent need or use case this app's users also search; plausible to rank/install",
  unrelated: "a different need; searchers would not want this app",
  brand: "the name of a specific other app, company or product",
};

export type RelevanceContext = { app: TrackedApp; tracked: TrackedKeyword[]; competitors: string[]; country: string };

export type RelevanceRun = { scores: Map<string, Relevance>; judged: number; cached: number; jevError?: string };

export type ScoreOptions = { context?: RelevanceContext; onProgress?: (done: number, total: number) => void; typesafe?: TypesafeOptions };

type Cached = { relevance: number; category: RelevanceCategory };

export function relevanceStatus(): RelevanceStatus {
  return { configured: isTypesafeConfigured(), model: typesafeModel() };
}

export async function relevanceContext(workspaceId: string, appId: number, country: string): Promise<RelevanceContext> {
  const [app, tracked, competitors] = await Promise.all([
    getApp(workspaceId, appId),
    listKeywords(workspaceId, appId, country),
    db.all<{ name: string }>("SELECT c.name FROM competitors c JOIN apps a ON a.id = c.app_id WHERE a.workspace_id = ? AND c.app_id = ?", [workspaceId, appId]),
  ]);
  return { app, tracked, competitors: competitors.map((c) => c.name), country };
}

function appText(app: TrackedApp) {
  return {
    name: app.store.trackName ?? app.name,
    subtitle: app.subtitle?.trim() || null,
    genre: app.store.primaryGenreName ?? null,
    description: (app.store.description ?? "").slice(0, DESCRIPTION_CHARS),
  };
}

function ownBrands(app: TrackedApp) {
  const title = app.store.trackName ?? app.name;
  const out = new Set([normalizeTerm(title), normalizeTerm(segments(title)[0] ?? title)]);
  if (app.developer) out.add(normalizeTerm(app.developer));
  return out;
}

function withOwnBrand(scores: Map<string, Relevance>, app: TrackedApp) {
  const own = ownBrands(app);
  for (const [term, r] of scores) if (own.has(term)) scores.set(term, { ...r, relevance: 100, category: "core" });
  return scores;
}

function profileHash(app: TrackedApp) {
  const t = appText(app);
  return createHash("sha1").update([t.name, t.subtitle ?? "", t.genre ?? "", t.description].join("\u0000")).digest("hex").slice(0, 12);
}

function topTracked(tracked: TrackedKeyword[]) {
  return [...tracked]
    .sort((a, b) => (a.position ?? 1000) - (b.position ?? 1000) || (b.popularity ?? 0) - (a.popularity ?? 0))
    .slice(0, TRACKED_IN_STATE);
}

function stateFor(ctx: RelevanceContext) {
  const t = appText(ctx.app);
  const country = isCountry(ctx.country) ? getCountry(ctx.country) : null;
  return {
    task: "Judge how relevant App Store search keywords are to this app for people searching in this storefront.",
    app: { name: t.name, subtitle: t.subtitle, primaryGenre: t.genre, description: t.description, developer: ctx.app.developer },
    note: "Searches for this app's own name or developer are core, not brand.",
    trackedKeywords: {
      note: "Keywords the developer tracks with the app's current search rank (null = not in the top 200). Some may be poor fits.",
      items: topTracked(ctx.tracked).map((k) => ({ keyword: k.term, rank: k.position })),
    },
    competitors: ctx.competitors.slice(0, 20),
    storefront: { country: country?.name ?? ctx.country.toUpperCase(), code: ctx.country.toUpperCase(), searchLanguages: searchLanguages(ctx.country) },
  };
}

function vocabularyFor(ctx: RelevanceContext): Vocabulary {
  const t = appText(ctx.app);
  return buildVocabulary({
    title: t.name,
    subtitle: t.subtitle,
    description: ctx.app.store.description ?? "",
    genre: t.genre,
    tracked: ctx.tracked.map((k) => ({ term: k.term, position: k.position })),
    competitors: ctx.competitors,
  });
}

export function relevanceFromProbabilities(p: Record<RelevanceCategory, number>) {
  return Math.max(0, Math.min(100, Math.round(100 * (p.core + RELATED_WEIGHT * p.related))));
}

export function categoryFor(choice: RelevanceCategory, relevance: number): RelevanceCategory {
  return (choice === "core" || choice === "related") && relevance < MIN_RELATED ? "unrelated" : choice;
}

export function heuristicRelevance(ctx: RelevanceContext, terms: string[]): Map<string, Relevance> {
  const vocab = vocabularyFor(ctx);
  return new Map(terms.map((term) => [term, { ...heuristicScore(term, vocab), languageMatch: languageMatches(term, ctx.country), source: "heuristic" as const }]));
}

export async function scoreRelevance(workspaceId: string, appId: number, terms: string[], country: string, opts: ScoreOptions = {}): Promise<RelevanceRun> {
  const ctx = opts.context ?? (await relevanceContext(workspaceId, appId, country));
  const unique = [...new Set(terms.map(normalizeTerm).filter(Boolean))];
  const scores = heuristicRelevance(ctx, unique);
  if (!unique.length || !isTypesafeConfigured()) {
    opts.onProgress?.(unique.length, unique.length);
    return { scores: withOwnBrand(scores, ctx.app), judged: 0, cached: 0 };
  }

  const hash = profileHash(ctx.app);
  const keyOf = (term: string) => wsKey(workspaceId, `relevance:${KEY_VERSION}:${appId}:${hash}:${country}:${term}`);
  const hits = await cacheGetMany<Cached>(unique.map(keyOf));
  let cached = 0;
  const pending: string[] = [];
  for (const term of unique) {
    const hit = hits.get(keyOf(term));
    if (hit && typeof hit.relevance === "number" && hit.category in CRITERIA) {
      scores.set(term, { relevance: hit.relevance, category: hit.category, languageMatch: languageMatches(term, country), source: "jev" });
      cached++;
    } else pending.push(term);
  }

  const total = unique.length;
  let done = cached;
  opts.onProgress?.(done, total);
  const batches: string[][] = [];
  for (let i = 0; i < pending.length; i += BATCH) batches.push(pending.slice(i, i + BATCH));
  const state = stateFor(ctx);
  const storefront = state.storefront.country;
  let jevError: string | undefined;
  let stopped = false;
  let judged = 0;

  await mapLimit(batches, PARALLEL, async (batch) => {
    if (!stopped) {
      try {
        const questions = Object.fromEntries(
          batch.map((term, i) => [`k${i}`, `Someone types "${term}" into App Store search in ${storefront}. Judge what they are looking for, and whether this app is what they want.`]),
        );
        const { answers } = await typesafeChoices({ state, questions, criteria: CRITERIA }, opts.typesafe);
        const fresh: [string, Cached][] = [];
        batch.forEach((term, i) => {
          const answer = answers[`k${i}`];
          if (!answer) return;
          const relevance = relevanceFromProbabilities(answer.probabilities);
          const value: Cached = { relevance, category: categoryFor(answer.choice, relevance) };
          scores.set(term, { ...value, languageMatch: languageMatches(term, country), source: "jev" });
          fresh.push([keyOf(term), value]);
        });
        judged += fresh.length;
        if (fresh.length < batch.length) jevError ??= "Jev skipped some keywords";
        if (fresh.length) await cacheSetMany(fresh, TTL);
      } catch (error) {
        jevError = error instanceof Error ? error.message : "Jev relevance failed";
        if (error instanceof TypesafeError && (error.code === "unauthorized" || error.code === "unconfigured" || error.code === "invalid")) stopped = true;
      }
    }
    done += batch.length;
    opts.onProgress?.(done, total);
  });

  return { scores: withOwnBrand(scores, ctx.app), judged, cached, jevError };
}
