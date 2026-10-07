import { getApp } from "@/lib/aso/apps";
import { listKeywords, type TrackedKeyword } from "@/lib/aso/keywords";
import { isStopword, tokenize } from "@/lib/suggestions/text";
import type { Insight, InsightSeverity, MetadataInsights } from "./types";

const LIMIT = 30;
const ORDER: Record<InsightSeverity, number> = { high: 0, medium: 1, low: 2, positive: 3 };

type Scored = TrackedKeyword & { popularity: number; difficulty: number; opportunity: number };

function contentWords(text: string) {
  return tokenize(text).filter((w) => !isStopword(w));
}

function stem(word: string) {
  return word.length > 3 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word;
}

function covers(words: Set<string>, term: string) {
  const parts = contentWords(term);
  return parts.length > 0 && parts.every((w) => words.has(stem(w)));
}

function quote(term: string) {
  return `“${term}”`;
}

function lengthInsights(field: "Title" | "Subtitle", value: string): Insight[] {
  const len = [...value].length;
  const id = `length-${field.toLowerCase()}`;
  if (field === "Subtitle" && len === 0)
    return [
      {
        id,
        kind: "length",
        severity: "medium",
        title: "No subtitle on record",
        detail: "The subtitle is indexed for search and gives you 30 more characters. Enter your live subtitle so insights can account for it.",
      },
    ];
  if (len > LIMIT)
    return [{ id, kind: "length", severity: "high", title: `${field} is ${len - LIMIT} characters over the limit`, detail: `App Store Connect caps the ${field.toLowerCase()} at ${LIMIT} characters. Trim it before your next submission.` }];
  if (len === LIMIT) return [{ id, kind: "length", severity: "positive", title: `${field} uses all ${LIMIT} characters`, detail: "Every indexed character is put to work." }];
  const free = LIMIT - len;
  return [
    {
      id,
      kind: "length",
      severity: free >= 10 ? "medium" : "low",
      title: `${free} unused ${free === 1 ? "character" : "characters"} in your ${field.toLowerCase()}`,
      detail: `You are using ${len}/${LIMIT}. Spare room can hold another searchable word from your keyword list.`,
    },
  ];
}

export async function metadataInsights(workspaceId: string, appId: number, country: string): Promise<MetadataInsights> {
  const app = await getApp(workspaceId, appId);
  const title = app.store.trackName ?? app.name;
  const subtitle = app.subtitle?.trim() || null;
  const titleWords = new Set(contentWords(title).map(stem));
  const subtitleWords = new Set(contentWords(subtitle ?? "").map(stem));
  const metaWords = new Set([...titleWords, ...subtitleWords]);
  const subtitleFree = LIMIT - [...(subtitle ?? "")].length;

  const scored = (await listKeywords(workspaceId, appId, country)).filter((k): k is Scored => k.popularity != null && k.difficulty != null && k.opportunity != null);
  const insights: Insight[] = [...lengthInsights("Title", title), ...lengthInsights("Subtitle", subtitle ?? "")];

  const dupes = [...new Set(contentWords(title).filter((w) => subtitleWords.has(stem(w))))];
  for (const word of dupes)
    insights.push({
      id: `duplicate-${word}`,
      kind: "duplicate",
      severity: "medium",
      keyword: word,
      title: `${quote(word)} appears in both title and subtitle`,
      detail: `Apple indexes each word once across these fields, so the repeat wastes ${[...word].length + 1} characters you could give to a new keyword.`,
    });

  const flagged = new Set<string>();
  const popularCut = Math.max(45, quantile(scored.map((k) => k.popularity), 0.75));
  const titleGaps = scored
    .filter((k) => k.popularity >= popularCut && !covers(titleWords, k.term))
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, 3);
  for (const k of titleGaps) {
    flagged.add(k.term);
    const inSubtitle = covers(subtitleWords, k.term);
    insights.push({
      id: `title-gap-${k.term}`,
      kind: "title-gap",
      severity: inSubtitle ? "medium" : "high",
      keyword: k.term,
      title: inSubtitle ? `Promote ${quote(k.term)} from subtitle to title` : `Lead your title with ${quote(k.term)}`,
      detail: `Popularity ${k.popularity} makes it one of your highest-demand keywords, but it isn't in your title. Words near the start of the title carry the most ranking weight.`,
    });
  }

  const subtitleFits = scored
    .filter((k) => !flagged.has(k.term) && k.difficulty <= 40 && k.popularity >= 20 && !covers(metaWords, k.term))
    .sort((a, b) => b.opportunity - a.opportunity)
    .slice(0, 3);
  for (const k of subtitleFits) {
    flagged.add(k.term);
    const needed = [...k.term].length + (subtitle ? 1 : 0);
    insights.push({
      id: `subtitle-fit-${k.term}`,
      kind: "subtitle-fit",
      severity: "medium",
      keyword: k.term,
      title: `${quote(k.term)} is a good subtitle candidate`,
      detail:
        needed <= subtitleFree
          ? `Difficulty ${k.difficulty} with popularity ${k.popularity}. It fits in the ${subtitleFree} characters your subtitle has left.`
          : `Difficulty ${k.difficulty} with popularity ${k.popularity}. It needs ${needed} characters, so swap it in for a weaker word in your subtitle.`,
    });
  }

  for (const k of scored.filter((x) => x.difficulty >= 75).sort((a, b) => b.difficulty - a.difficulty)) {
    const words = new Set(contentWords(k.term).map(stem));
    const alt = scored
      .filter((o) => o.term !== k.term && o.difficulty <= k.difficulty - 20 && o.popularity >= k.popularity * 0.5 && contentWords(o.term).some((w) => words.has(stem(w))))
      .sort((a, b) => b.opportunity - a.opportunity)[0];
    if (!alt) continue;
    insights.push({
      id: `alternative-${k.term}`,
      kind: "alternative",
      severity: k.position == null || k.position > 10 ? "medium" : "low",
      keyword: k.term,
      title: `${quote(k.term)} is crowded, try ${quote(alt.term)}`,
      detail: `Difficulty ${k.difficulty} vs ${alt.difficulty} for a related phrase with popularity ${alt.popularity}. Ranking on the easier one first builds relevance for the head term.`,
    });
    if (insights.filter((i) => i.kind === "alternative").length >= 3) break;
  }

  scored
    .filter((k) => k.position == null && k.popularity >= 20 && covers(metaWords, k.term) && !flagged.has(k.term))
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, 3)
    .forEach((k) =>
      insights.push({
        id: `not-ranking-${k.term}`,
        kind: "not-ranking",
        severity: "low",
        keyword: k.term,
        title: `In your metadata but unranked for ${quote(k.term)}`,
        detail: "You don't appear in the top 200 results yet. Rankings for new metadata can take a few days; if it persists, the competition may need more ratings or downloads than you have.",
      }),
    );

  scored
    .filter((k) => k.position != null && k.position <= 10 && covers(titleWords, k.term))
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, 2)
    .forEach((k) =>
      insights.push({
        id: `working-${k.term}`,
        kind: "working",
        severity: "positive",
        keyword: k.term,
        title: `${quote(k.term)} in your title is paying off`,
        detail: `You rank #${k.position} for it with popularity ${k.popularity}. Keep it in place when you edit the title.`,
      }),
    );

  return {
    appId,
    country,
    title,
    subtitle,
    limit: LIMIT,
    titleLength: [...title].length,
    subtitleLength: [...(subtitle ?? "")].length,
    keywordsAnalyzed: scored.length,
    insights: insights.sort((a, b) => ORDER[a.severity] - ORDER[b.severity]),
  };
}

function quantile(values: number[], q: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}
