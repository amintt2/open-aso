import { normalizeTerm } from "@/lib/aso/scoring";
import { isWeak, segments, tokenize } from "@/lib/suggestions/text";
import type { RelevanceCategory } from "./types";

export type HeuristicProfile = {
  title: string;
  subtitle: string | null;
  description: string;
  genre: string | null;
  tracked: { term: string; position: number | null }[];
  competitors: string[];
};

export type Vocabulary = { weights: Map<string, number>; brands: Set<string> };

const BOILERPLATE = /subscri|renew|payment|charged|cancel|terms|privacy|account|https?:|eula|policy|trial/i;

export function stem(word: string) {
  let w = word;
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
  if (w.length > 5 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith("er")) w = w.slice(0, -2);
  return w;
}

function words(text: string) {
  return tokenize(text)
    .filter((w) => !isWeak(w) && /\p{L}/u.test(w))
    .map(stem);
}

function bump(map: Map<string, number>, text: string, weight: number) {
  for (const w of words(text)) map.set(w, Math.max(map.get(w) ?? 0, weight));
}

export function buildVocabulary(p: HeuristicProfile): Vocabulary {
  const weights = new Map<string, number>();
  const counts = new Map<string, number>();
  for (const sentence of p.description.split(/[.!?\n•●▪◆★✓✔*]+/u)) {
    if (BOILERPLATE.test(sentence)) continue;
    for (const w of words(sentence)) counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  for (const [w, n] of counts) weights.set(w, n >= 3 ? 0.7 : n === 2 ? 0.5 : 0.25);
  if (p.genre) bump(weights, p.genre, 0.5);
  for (const k of p.tracked) if (k.position != null && k.position <= 50) bump(weights, k.term, 0.7);
  bump(weights, p.subtitle ?? "", 0.9);
  bump(weights, p.title, 1);

  const brands = new Set<string>();
  for (const name of p.competitors) {
    brands.add(normalizeTerm(name));
    const parts = segments(name);
    if (parts.length < 2) continue;
    for (const part of parts.map(normalizeTerm)) if (part && !part.includes(" ") && !weights.has(stem(part))) brands.add(part);
  }
  return { weights, brands };
}

export function heuristicScore(term: string, vocab: Vocabulary): { relevance: number; category: RelevanceCategory } {
  const t = normalizeTerm(term);
  if (vocab.brands.has(t)) return { relevance: 5, category: "brand" };
  const parts = words(t);
  if (!parts.length) return { relevance: 0, category: "unrelated" };
  const scores = parts.map((w) => vocab.weights.get(w) ?? 0);
  const mean = scores.reduce((s, v) => s + v, 0) / scores.length;
  const relevance = Math.round(100 * (0.75 * mean + 0.25 * Math.min(...scores)));
  return { relevance, category: relevance >= 60 ? "core" : relevance >= 35 ? "related" : "unrelated" };
}
