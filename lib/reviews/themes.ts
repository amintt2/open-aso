import { countGrams, tokenize } from "@/lib/explore/text";
import type { Review } from "@/lib/appstore/itunes";
import type { Theme } from "./types";

const GENERIC = new Set(
  "never nothing back still always anything something everything someone anyone everyone people person thing stuff literally actually honestly even ever keeps keep getting got doesnt dont didnt cant wont isnt app apps phone phones account accounts love like good bad terrible horrible awful worst best great amazing nice cool please fix fixed help without away many says said say saying tried trying try reason yet already since anymore another new old used".split(" "),
);

function textOf(review: Pick<Review, "title" | "content">) {
  return `${review.title}. ${review.content}`;
}

function themesFor(group: Review[], other: Review[], limit: number, exclude: Set<string>): Theme[] {
  if (!group.length) return [];
  const counts = countGrams(group.map(textOf), 2);
  const otherCounts = countGrams(other.map(textOf), 2);
  const minCount = Math.max(2, Math.ceil(group.length * 0.015));
  const candidates = [...counts.entries()]
    .filter(([phrase, count]) => {
      const words = phrase.split(" ");
      if (words.every((w) => GENERIC.has(w) || exclude.has(w))) return false;
      return count >= (words.length > 1 ? 2 : minCount);
    })
    .map(([phrase, count]) => {
      const share = count / group.length;
      const otherShare = ((otherCounts.get(phrase) ?? 0) + 0.5) / (other.length + 1);
      const lift = share / otherShare;
      const words = phrase.split(" ").length;
      return { phrase, count, share, score: count * Math.log2(1 + lift) * (words > 1 ? 2.5 : 1) };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);
  const picked: typeof candidates = [];
  for (const c of candidates) {
    if (picked.length >= limit) break;
    const words = c.phrase.split(" ");
    if (words.length === 1) {
      if (!picked.some((p) => p.phrase.split(" ").includes(c.phrase))) picked.push(c);
      continue;
    }
    if (picked.some((p) => p.phrase === c.phrase)) continue;
    const idx = picked.findIndex((p) => !p.phrase.includes(" ") && words.includes(p.phrase));
    if (idx < 0) picked.push(c);
    else if (c.count >= picked[idx].count * 0.4) picked[idx] = c;
  }
  return picked.map(({ phrase, count, share }) => {
    const matching = group.filter((r) => textOf(r).toLowerCase().includes(phrase));
    const avgRating = matching.length ? matching.reduce((s, r) => s + r.rating, 0) / matching.length : 0;
    return { phrase, count, share, avgRating: Math.round(avgRating * 10) / 10 };
  });
}

export function reviewThemes(reviews: Review[], appName = "", limit = 14) {
  const exclude = new Set(tokenize(appName));
  const low = reviews.filter((r) => r.rating <= 2);
  const high = reviews.filter((r) => r.rating >= 4);
  return {
    negative: themesFor(low, high, limit, exclude),
    positive: themesFor(high, low, limit, exclude),
    lowCount: low.length,
    highCount: high.length,
  };
}
