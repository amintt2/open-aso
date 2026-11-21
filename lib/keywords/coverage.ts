import { getCountry, isCountry } from "@/lib/appstore/countries";
import { getApp, type TrackedApp } from "@/lib/aso/apps";
import { normalizeTerm } from "@/lib/aso/scoring";
import { isStopword, tokenize } from "@/lib/suggestions/text";

export type MetadataField = "title" | "subtitle" | "keywords" | "category";

export type LocaleListing = { locale: string; title: string; subtitle: string | null; keywords: string | null };

export type StorefrontListing = { country: string; source: "app-store-connect" | "store"; primaryLocale: string; category: string | null; locales: LocaleListing[] };

export type CoverageMatch = "exact" | "words" | "partial" | "none";

export type KeywordCoverage = {
  match: CoverageMatch;
  field: MetadataField | null;
  fields: MetadataField[];
  locale: string | null;
  primaryLocale: boolean;
  missing: string[];
  score: number;
};

export const FIELD_WEIGHT: Record<MetadataField, number> = { title: 1, subtitle: 0.7, keywords: 0.45, category: 0.3 };
export const TITLE_LEAD_BONUS = 0.15;
export const SECONDARY_LOCALE_WEIGHT = 0.8;
export const SPLIT_WEIGHT = 0.9;
export const PHRASE_BONUS = 1.2;
const PARTIAL_WEIGHT = 0.4;
const FIELDS: MetadataField[] = ["title", "subtitle", "keywords", "category"];

export const NO_COVERAGE: KeywordCoverage = { match: "none", field: null, fields: [], locale: null, primaryLocale: false, missing: [], score: 0 };

const UNSPACED = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u;

function sameLocale(a: string, b: string) {
  return a.toLowerCase() === b.toLowerCase();
}

function inflections(word: string) {
  const out: string[] = [];
  if (word.length > 3 && word.endsWith("es")) out.push(word.slice(0, -2));
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) out.push(word.slice(0, -1));
  else out.push(`${word}s`, `${word}es`);
  return out;
}

type IndexedField = { field: MetadataField; text: string; words: Set<string>; lead: Set<string>; entries: string[] };

type IndexedLocale = { locale: string; primary: boolean; english: boolean; fields: IndexedField[] };

function indexField(field: MetadataField, raw: string | null): IndexedField {
  const value = normalizeTerm(raw ?? "");
  const entries = field === "keywords" ? value.split(/[,،、，;]/).map((e) => e.trim()).filter(Boolean) : [value].filter(Boolean);
  const tokens = tokenize(value);
  return { field, text: ` ${tokens.join(" ")} `, words: new Set(entries.flatMap((e) => tokenize(e))), lead: new Set(field === "title" ? tokens.slice(0, 2) : []), entries };
}

function indexLocale(l: LocaleListing, primary: boolean, category: string | null): IndexedLocale {
  return {
    locale: l.locale,
    primary,
    english: l.locale.toLowerCase().startsWith("en"),
    fields: [indexField("title", l.title), indexField("subtitle", l.subtitle), indexField("keywords", l.keywords), indexField("category", primary ? category : null)],
  };
}

function wordWeight(loc: IndexedLocale, word: string): { field: MetadataField; weight: number } | null {
  let best: { field: MetadataField; weight: number } | null = null;
  for (const f of loc.fields) {
    let credit = 0;
    if (UNSPACED.test(word)) credit = f.entries.some((e) => e.replace(/\s+/g, "").includes(word)) ? 1 : 0;
    else if (f.words.has(word)) credit = 1;
    else if (inflections(word).some((v) => f.words.has(v))) credit = loc.english ? 0.8 : 0.5;
    if (!credit) continue;
    const weight = credit * (FIELD_WEIGHT[f.field] + (f.lead.has(word) ? TITLE_LEAD_BONUS : 0));
    if (!best || weight > best.weight) best = { field: f.field, weight };
  }
  return best;
}

function phraseIn(f: IndexedField, term: string, words: string[]) {
  if (f.field === "keywords") return f.entries.includes(term);
  if (UNSPACED.test(term)) return f.entries.some((e) => e.replace(/\s+/g, "").includes(term.replace(/\s+/g, "")));
  return words.length > 0 && f.text.includes(` ${words.join(" ")} `);
}

function scoreLocale(loc: IndexedLocale, term: string): KeywordCoverage {
  const all = tokenize(term);
  const words = all.filter((w) => !isStopword(w));
  const needed = words.length ? words : all;
  if (!needed.length) return NO_COVERAGE;
  const localeWeight = loc.primary ? 1 : SECONDARY_LOCALE_WEIGHT;
  const found = needed.map((w) => wordWeight(loc, w));
  const hits = found.filter((f): f is { field: MetadataField; weight: number } => f != null);
  const missing = needed.filter((_, i) => found[i] == null);
  if (!hits.length) return { ...NO_COVERAGE, missing: needed };
  const fields = FIELDS.filter((f) => hits.some((h) => h.field === f));
  const base = { field: fields[fields.length - 1], fields, locale: loc.locale, primaryLocale: loc.primary };
  const mean = hits.reduce((s, h) => s + h.weight, 0) / needed.length;
  if (missing.length) return { ...base, match: "partial", missing, score: Math.round(100 * mean * localeWeight * PARTIAL_WEIGHT) };
  const phrase = loc.fields.find((f) => phraseIn(f, term, all));
  const factor = phrase && all.length > 1 && (phrase.field === "title" || phrase.field === "subtitle") ? PHRASE_BONUS : fields.length > 1 ? SPLIT_WEIGHT : 1;
  return { ...base, match: phrase ? "exact" : "words", missing: [], score: Math.min(100, Math.round(100 * mean * localeWeight * factor)) };
}

const RANK: Record<CoverageMatch, number> = { exact: 3, words: 2, partial: 1, none: 0 };

export function coverageIn(listing: StorefrontListing | null, term: string): KeywordCoverage {
  if (!listing?.locales.length) return NO_COVERAGE;
  const t = normalizeTerm(term);
  let best = NO_COVERAGE;
  listing.locales.forEach((l) => {
    const c = scoreLocale(indexLocale(l, sameLocale(l.locale, listing.primaryLocale), listing.category), t);
    if (c.score > best.score || (c.score === best.score && RANK[c.match] > RANK[best.match])) best = c;
  });
  return best;
}

export function isCovered(c: KeywordCoverage | null | undefined) {
  return c?.match === "exact" || c?.match === "words";
}

function storeListing(app: TrackedApp, country: string): StorefrontListing {
  const locale = isCountry(country) ? (getCountry(country).indexedLocales[0] ?? "en-US") : "en-US";
  return { country, source: "store", primaryLocale: locale, category: app.store.primaryGenreName ?? null, locales: [{ locale, title: app.store.trackName ?? app.name, subtitle: app.subtitle, keywords: null }] };
}

export async function storefrontListing(workspaceId: string, appId: number, country: string): Promise<StorefrontListing> {
  const app = await getApp(workspaceId, appId);
  if (!app.isMine) return storeListing(app, country);
  try {
    const { isAscConfigured } = await import("@/lib/asc/client");
    if (!app.ascAppId || !(await isAscConfigured(workspaceId))) return storeListing(app, country);
    const { getAppMetadata } = await import("@/lib/asc/metadata");
    const meta = await getAppMetadata(workspaceId, appId);
    const indexed = isCountry(country) ? getCountry(country).indexedLocales : [meta.primaryLocale];
    const locales = indexed.flatMap((code) => {
      const l = meta.localizations.find((x) => sameLocale(x.locale, code));
      return l && (l.name || l.subtitle || l.keywords) ? [{ locale: l.locale, title: l.name ?? "", subtitle: l.subtitle ?? null, keywords: l.keywords ?? null }] : [];
    });
    if (!locales.length) {
      const primary = meta.localizations.find((x) => sameLocale(x.locale, meta.primaryLocale));
      if (primary) locales.push({ locale: primary.locale, title: primary.name ?? "", subtitle: primary.subtitle ?? null, keywords: primary.keywords ?? null });
    }
    return locales.length ? { country, source: "app-store-connect", primaryLocale: indexed[0] ?? meta.primaryLocale, category: app.store.primaryGenreName ?? null, locales } : storeListing(app, country);
  } catch {
    return storeListing(app, country);
  }
}

export async function storefrontListings(workspaceId: string, appId: number, countries: string[]) {
  const unique = [...new Set(countries)];
  const listings = await Promise.all(unique.map((c) => storefrontListing(workspaceId, appId, c)));
  return new Map(unique.map((c, i) => [c, listings[i]]));
}

export async function withCoverage<K extends { term: string; country: string }>(workspaceId: string, appId: number, keywords: K[]) {
  const listings = await storefrontListings(workspaceId, appId, keywords.map((k) => k.country));
  return keywords.map((k) => ({ ...k, coverage: coverageIn(listings.get(k.country) ?? null, k.term) }));
}
