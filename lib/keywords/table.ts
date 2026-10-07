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
