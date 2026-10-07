import { searchHints } from "@/lib/appstore/itunes";
import type { TrackedApp } from "@/lib/aso/apps";
import type { TrackedKeyword } from "@/lib/aso/keywords";
import { normalizeTerm } from "@/lib/aso/scoring";
import { aiCandidates } from "./ai";
import { mapLimit } from "./jobs";
import { descriptiveSegments, isCleanPhrase, isWeak, phrasesFrom, segments, tokenize } from "./text";
import type { SuggestionSource } from "./types";

export type Candidate = { term: string; sources: SuggestionSource[]; weight: number };

export type GenerateInput = {
  workspaceId: string;
  app: TrackedApp;
  country: string;
  tracked: TrackedKeyword[];
  competitors: string[];
  useAi: boolean;
  onPlan?: (steps: number) => void;
  onStep?: () => void;
};

type Pool = Map<string, { sources: Set<SuggestionSource>; weight: number }>;

const MAX_HINT_TERMS = 20;
const MAX_HEAD_WORDS = 12;
const MAX_COMBOS = 24;

function add(pool: Pool, term: string, source: SuggestionSource, weight: number) {
  const t = normalizeTerm(term);
  if (!t || !isCleanPhrase(t)) return;
  const entry = pool.get(t) ?? { sources: new Set<SuggestionSource>(), weight: 0 };
  entry.sources.add(source);
  entry.weight += weight;
  pool.set(t, entry);
}

function variants(term: string) {
  const out = new Set([term]);
  out.add(term.endsWith("s") ? term.slice(0, -1) : `${term}s`);
  return out;
}

function countAcrossTitles(titles: string[], minApps: number) {
  const counts = new Map<string, number>();
  for (const title of titles) {
    const phrases = new Set(phrasesFrom(title));
    for (const p of phrases) counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  return [...counts].filter(([, n]) => n >= minApps);
}

function descriptionPhrases(description: string) {
  const counts = new Map<string, number>();
  for (const sentence of description.split(/[.!?\n•●▪◆★✓✔*]+/u)) {
    for (const p of phrasesFrom(sentence)) counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  return [...counts].filter(([p, n]) => (p.includes(" ") ? n >= 2 : n >= 3));
}

function brandTerms(app: TrackedApp) {
  const title = app.store.trackName ?? app.name;
  const brand = segments(title)[0] ?? title;
  const out = new Set<string>([normalizeTerm(brand)]);
  if (segments(title).length === 1 && tokenize(title).length <= 2) tokenize(title).forEach((w) => out.add(w));
  tokenize(app.developer ?? "").forEach((w) => out.add(w));
  return out;
}

export async function generateCandidates(input: GenerateInput): Promise<{ candidates: Candidate[]; aiError?: string; usedAi: boolean }> {
  const { app, country, tracked, competitors, useAi } = input;
  const pool: Pool = new Map();
  const trackedSet = new Set(tracked.flatMap((k) => [...variants(normalizeTerm(k.term))]));
  const byPopularity = [...tracked].sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
  const hintTerms = byPopularity.slice(0, MAX_HINT_TERMS).map((k) => normalizeTerm(k.term));
  const wordFreq = new Map<string, number>();
  for (const k of tracked) for (const w of new Set(tokenize(k.term))) if (w.length >= 3 && !isWeak(w)) wordFreq.set(w, (wordFreq.get(w) ?? 0) + 1);
  const headWords = [...wordFreq]
    .sort((a, b) => b[1] - a[1])
    .map(([w]) => w)
    .filter((w) => !hintTerms.includes(w))
    .slice(0, MAX_HEAD_WORDS);

  const queries = [...hintTerms.map((q) => ({ q, head: false })), ...headWords.map((q) => ({ q, head: true }))];
  input.onPlan?.(queries.length + (useAi ? 1 : 0));

  await mapLimit(queries, 4, async ({ q, head }) => {
    const hints = await searchHints(q, country).catch((): string[] => []);
    const words = tokenize(q);
    hints
      .filter((h) => h !== q && words.every((w) => tokenize(h).includes(w)))
      .forEach((h, i) => add(pool, h, "hints", Math.max(0.6, (head ? 2.2 : 3) - i * 0.15)));
    input.onStep?.();
  });

  const topTitles = new Map<number, string>();
  for (const k of tracked) for (const a of k.topApps) topTitles.set(a.trackId, a.name);
  for (const [phrase, n] of countAcrossTitles([...topTitles.values()], 2)) add(pool, phrase, "top-apps", Math.min(4, n * (phrase.includes(" ") ? 0.8 : 0.35)));
  for (const [phrase, n] of countAcrossTitles([...topTitles.values()].flatMap(descriptiveSegments), 2)) add(pool, phrase, "top-apps", Math.min(2, n * 0.4));

  const ownTitle = app.store.trackName ?? app.name;
  for (const seg of descriptiveSegments(ownTitle)) for (const p of phrasesFrom(seg)) add(pool, p, "metadata", 2);
  if (app.subtitle) for (const p of phrasesFrom(app.subtitle)) add(pool, p, "metadata", 2);
  for (const [phrase, n] of descriptionPhrases(app.store.description ?? "")) add(pool, phrase, "metadata", Math.min(3, n * 0.5));

  for (const name of competitors) for (const seg of descriptiveSegments(name)) for (const p of phrasesFrom(seg)) add(pool, p, "competitors", 1.5);
  for (const [phrase, n] of countAcrossTitles(competitors, 2)) add(pool, phrase, "competitors", n);

  const modifiers = new Set<string>();
  const heads = new Set<string>();
  for (const k of tracked) {
    const words = tokenize(k.term).filter((w) => !isWeak(w));
    if (words.length === 1) modifiers.add(words[0]);
    if (words.length >= 2) {
      heads.add(words[words.length - 1]);
      words.slice(0, -1).forEach((w) => modifiers.add(w));
    }
  }
  let combos = 0;
  outer: for (const m of modifiers) {
    for (const h of heads) {
      if (m === h) continue;
      add(pool, `${m} ${h}`, "combo", 0.8);
      if (++combos >= MAX_COMBOS) break outer;
    }
  }

  let aiError: string | undefined;
  let usedAi = false;
  if (useAi) {
    try {
      const list = await aiCandidates(input.workspaceId, {
        title: ownTitle,
        subtitle: app.subtitle,
        description: app.store.description ?? "",
        genre: app.store.primaryGenreName,
        country,
        tracked: tracked.map((k) => k.term),
        competitors,
      });
      list.forEach((t) => add(pool, t, "ai", 2.5));
      usedAi = true;
    } catch (error) {
      aiError = error instanceof Error ? error.message : "AI suggestions failed";
    } finally {
      input.onStep?.();
    }
  }

  const brands = brandTerms(app);
  const candidates = [...pool]
    .filter(([term]) => !trackedSet.has(term) && !brands.has(term))
    .map(([term, v]) => ({ term, sources: [...v.sources], weight: v.weight + (v.sources.size - 1) * 0.8 }))
    .sort((a, b) => b.weight - a.weight);
  return { candidates, aiError, usedAi };
}
