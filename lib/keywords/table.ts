import { normalizeTerm, type TargetingLabel } from "@/lib/aso/scoring";
import type { TrackedKeyword } from "@/lib/client/types";

export const TARGETING_LABELS: TargetingLabel[] = [
  "Sweet Spot",
  "Hidden Gem",
  "Quick Win",
  "High Potential",
  "Competitive",
  "Very Competitive",
  "Low Volume",
];

export const STALE_HOURS = 20;
export const MAX_TERM_LENGTH = 100;

export type SortKey =
  | "term"
  | "popularity"
  | "difficulty"
  | "label"
  | "position"
  | "downloadsEst"
  | "top5Downloads"
  | "top5Mrr"
  | "resultsCount"
  | "lastRefreshedAt";

export type Sort = { key: SortKey; dir: "asc" | "desc" };

export type Filters = {
  labels: TargetingLabel[];
  likedOnly: boolean;
  rankedOnly: boolean;
  popularity: [number, number];
  difficulty: [number, number];
};

export const DEFAULT_FILTERS: Filters = {
  labels: [],
  likedOnly: false,
  rankedOnly: false,
  popularity: [0, 100],
  difficulty: [0, 100],
};

export function activeFilterCount(f: Filters) {
  return (
    (f.labels.length ? 1 : 0) +
    (f.likedOnly ? 1 : 0) +
    (f.rankedOnly ? 1 : 0) +
    (f.popularity[0] > 0 || f.popularity[1] < 100 ? 1 : 0) +
    (f.difficulty[0] > 0 || f.difficulty[1] < 100 ? 1 : 0)
  );
}

function inRange(value: number | null, [min, max]: [number, number]) {
  if (min === 0 && max === 100) return true;
  return value != null && value >= min && value <= max;
}

export function filterKeywords(
  list: TrackedKeyword[],
  query: string,
  f: Filters,
) {
  const q = normalizeTerm(query);
  return list.filter(
    (k) =>
      (!q || k.term.includes(q) || (k.notes ?? "").toLowerCase().includes(q)) &&
      (!f.labels.length || (k.label != null && f.labels.includes(k.label))) &&
      (!f.likedOnly || k.liked) &&
      (!f.rankedOnly || k.position != null) &&
      inRange(k.popularity, f.popularity) &&
      inRange(k.difficulty, f.difficulty),
  );
}

function sortValue(k: TrackedKeyword, key: SortKey): string | number | null {
  if (key === "lastRefreshedAt")
    return k.lastRefreshedAt ? parseDate(k.lastRefreshedAt) : null;
  if (key === "label")
    return k.label ? TARGETING_LABELS.indexOf(k.label) : null;
  return k[key];
}

export function sortKeywords(list: TrackedKeyword[], sort: Sort) {
  const sign = sort.dir === "asc" ? 1 : -1;
  return [...list].sort((a, b) => {
    const av = sortValue(a, sort.key);
    const bv = sortValue(b, sort.key);
    if (av == null && bv == null) return a.term.localeCompare(b.term);
    if (av == null) return 1;
    if (bv == null) return -1;
    const cmp =
      typeof av === "string" && typeof bv === "string"
        ? av.localeCompare(bv)
        : Number(av) - Number(bv);
    return cmp === 0 ? a.term.localeCompare(b.term) : cmp * sign;
  });
}

export function defaultDir(key: SortKey): Sort["dir"] {
  return key === "term" ||
    key === "position" ||
    key === "difficulty" ||
    key === "label"
    ? "asc"
    : "desc";
}

export function parseDate(value: string) {
  return new Date(
    value.includes("T") ? value : `${value.replace(" ", "T")}Z`,
  ).getTime();
}

export function isStale(k: TrackedKeyword, hours = STALE_HOURS) {
  return (
    !k.lastRefreshedAt ||
    Date.now() - parseDate(k.lastRefreshedAt) > hours * 3600000
  );
}

export type MetadataMatch = "full" | "partial" | null;

export function metadataMatch(
  text: string | null | undefined,
  term: string,
): MetadataMatch {
  if (!text) return null;
  const haystack = normalizeTerm(text);
  const t = normalizeTerm(term);
  if (!t) return null;
  if (haystack.includes(t)) return "full";
  const words = t.split(" ").filter((w) => w.length > 1);
  const tokens = new Set(haystack.split(/[^\p{L}\p{N}]+/u));
  return words.length > 1 && words.some((w) => tokens.has(w))
    ? "partial"
    : null;
}

export function parseTerms(input: string) {
  return [
    ...new Set(
      input
        .split(/[,\n;]+/)
        .map(normalizeTerm)
        .filter(Boolean),
    ),
  ];
}

export function csvRows(list: TrackedKeyword[]) {
  const header = [
    "Keyword",
    "Notes",
    "Last update",
    "Country",
    "Popularity",
    "Difficulty",
    "Label",
    "Downloads",
    "Position",
    "Top apps",
  ];
  return [
    header,
    ...list.map((k) => [
      k.term,
      k.notes ?? "",
      k.lastRefreshedAt
        ? new Date(parseDate(k.lastRefreshedAt)).toISOString()
        : "",
      k.country.toUpperCase(),
      k.popularity ?? "",
      k.difficulty ?? "",
      k.label ?? "",
      k.downloadsEst ?? "",
      k.position ?? "",
      k.topApps.map((a) => a.name).join(" | "),
    ]),
  ];
}

export function keywordInsight(
  k: TrackedKeyword,
  inTitle: MetadataMatch,
  inSubtitle: MetadataMatch,
) {
  const pop = k.popularity;
  const diff = k.difficulty;
  if (pop == null || diff == null)
    return "Analysis pending — scores appear once the first refresh completes.";
  if (k.position != null && k.position <= 3)
    return "You hold a podium spot. Keep the term in your metadata and watch competitors that rank right below you.";
  if (pop >= 50 && inTitle !== "full" && diff < 80)
    return "Searched often and missing from your title. Working it into the title is likely the biggest ranking lever you have here.";
  if (diff >= 80)
    return "The first page is owned by heavyweight apps. Consider longer-tail variations of this phrase that face weaker competition.";
  if (diff <= 40 && pop >= 20 && !inTitle && !inSubtitle)
    return "Competition is light. Featuring it in your subtitle could move you onto the first page quickly.";
  if (k.position != null && k.position <= 10)
    return "Already on the first page. Small metadata tweaks and fresh ratings can push it into the top 3.";
  if (pop < 20)
    return "Low search volume. Keep it in the hidden keyword field rather than spending title or subtitle space on it.";
  return "Balanced keyword. Keep it in your keyword field and track how your position responds to each release.";
}

export type KeywordGroup = {
  term: string;
  rows: TrackedKeyword[];
  ids: number[];
  countries: string[];
  bestPosition: TrackedKeyword | null;
  bestPopularity: TrackedKeyword | null;
  popularity: number | null;
  difficulty: number | null;
  label: TargetingLabel | null;
  downloadsEst: number | null;
  lastRefreshedAt: string | null;
  pending: boolean;
  liked: boolean;
  notes: string | null;
};

export type GroupSortKey =
  | "term"
  | "countries"
  | "position"
  | "popularity"
  | "difficulty"
  | "label"
  | "downloadsEst"
  | "lastRefreshedAt";

export type GroupSort = { key: GroupSortKey; dir: "asc" | "desc" };

function byPosition(a: TrackedKeyword, b: TrackedKeyword) {
  if (a.position == null && b.position == null)
    return (b.popularity ?? -1) - (a.popularity ?? -1);
  if (a.position == null) return 1;
  if (b.position == null) return -1;
  return a.position - b.position;
}

function mostCommonLabel(rows: TrackedKeyword[], fallback: TargetingLabel | null) {
  const counts = new Map<TargetingLabel, number>();
  rows.forEach((k) => k.label && counts.set(k.label, (counts.get(k.label) ?? 0) + 1));
  let best: TargetingLabel | null = null;
  let max = 0;
  for (const [label, n] of counts) {
    if (n > max || (n === max && label === fallback)) {
      best = label;
      max = n;
    }
  }
  return best;
}

function toGroup(term: string, rows: TrackedKeyword[]): KeywordGroup {
  const sorted = [...rows].sort(byPosition);
  const ranked = sorted.find((k) => k.position != null) ?? null;
  const scored = rows.filter((k) => k.popularity != null);
  const bestPopularity = scored.length
    ? scored.reduce((a, b) => ((b.popularity ?? 0) > (a.popularity ?? 0) ? b : a))
    : null;
  const difficulties = rows
    .map((k) => k.difficulty)
    .filter((d): d is number => d != null);
  const downloads = rows
    .map((k) => k.downloadsEst)
    .filter((d): d is number => d != null);
  const refreshed = rows.map((k) => k.lastRefreshedAt);
  const notes = rows
    .filter((k) => k.notes)
    .map((k) => `${k.country.toUpperCase()}: ${k.notes}`);
  return {
    term,
    rows: sorted,
    ids: sorted.map((k) => k.id),
    countries: sorted.map((k) => k.country),
    bestPosition: ranked,
    bestPopularity,
    popularity: bestPopularity?.popularity ?? null,
    difficulty: difficulties.length
      ? Math.round(difficulties.reduce((s, d) => s + d, 0) / difficulties.length)
      : null,
    label: mostCommonLabel(rows, bestPopularity?.label ?? null),
    downloadsEst: downloads.length ? downloads.reduce((s, d) => s + d, 0) : null,
    lastRefreshedAt: refreshed.some((d) => !d)
      ? null
      : (refreshed as string[]).reduce((a, b) => (parseDate(b) < parseDate(a) ? b : a)),
    pending: rows.every((k) => k.popularity == null),
    liked: rows.some((k) => k.liked),
    notes: notes.length ? notes.join("\n") : null,
  };
}

export function groupKeywords(list: TrackedKeyword[]) {
  const map = new Map<string, TrackedKeyword[]>();
  for (const k of list) {
    const term = normalizeTerm(k.term);
    const rows = map.get(term);
    if (rows) rows.push(k);
    else map.set(term, [k]);
  }
  return [...map].map(([term, rows]) => toGroup(term, rows));
}

export function filterGroups(
  groups: KeywordGroup[],
  query: string,
  f: Filters,
  minCountries: number,
) {
  return groups.filter(
    (g) =>
      g.countries.length >= minCountries &&
      filterKeywords(g.rows, query, f).length > 0,
  );
}

function groupValue(g: KeywordGroup, key: GroupSortKey): string | number | null {
  if (key === "term") return g.term;
  if (key === "countries") return g.countries.length;
  if (key === "position") return g.bestPosition?.position ?? null;
  if (key === "label") return g.label ? TARGETING_LABELS.indexOf(g.label) : null;
  if (key === "lastRefreshedAt")
    return g.lastRefreshedAt ? parseDate(g.lastRefreshedAt) : null;
  return g[key];
}

export function sortGroups(groups: KeywordGroup[], sort: GroupSort) {
  const sign = sort.dir === "asc" ? 1 : -1;
  return [...groups].sort((a, b) => {
    const av = groupValue(a, sort.key);
    const bv = groupValue(b, sort.key);
    if (av == null && bv == null) return a.term.localeCompare(b.term);
    if (av == null) return 1;
    if (bv == null) return -1;
    const cmp =
      typeof av === "string" && typeof bv === "string"
        ? av.localeCompare(bv)
        : Number(av) - Number(bv);
    return cmp === 0 ? a.term.localeCompare(b.term) : cmp * sign;
  });
}

export function defaultGroupDir(key: GroupSortKey): GroupSort["dir"] {
  return key === "term" ||
    key === "position" ||
    key === "difficulty" ||
    key === "label"
    ? "asc"
    : "desc";
}
