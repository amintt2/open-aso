import type { StoreApp } from "@/lib/appstore/itunes";

export type TargetingLabel =
  | "Sweet Spot"
  | "Hidden Gem"
  | "Quick Win"
  | "High Potential"
  | "Competitive"
  | "Very Competitive"
  | "Low Volume";

const MARKET_SIZE: Record<string, number> = {
  us: 1, cn: 0.9, jp: 0.45, gb: 0.2, de: 0.18, fr: 0.15, kr: 0.15, ca: 0.11, au: 0.09,
  br: 0.12, ru: 0.1, it: 0.09, es: 0.09, mx: 0.08, in: 0.1, tw: 0.06, nl: 0.05, tr: 0.06,
  sa: 0.05, id: 0.05, th: 0.04, hk: 0.04, se: 0.03, ch: 0.03, pl: 0.04, ae: 0.03, sg: 0.025,
  be: 0.03, at: 0.025, no: 0.02, dk: 0.02, fi: 0.015, ie: 0.015, nz: 0.015, pt: 0.02,
  il: 0.02, my: 0.025, ph: 0.025, vn: 0.03, za: 0.02, cl: 0.015, co: 0.015, ar: 0.015,
};

export function marketSize(country: string) {
  return MARKET_SIZE[country] ?? 0.01;
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function normalizeTerm(term: string) {
  return term.toLowerCase().normalize("NFKC").replace(/\s+/g, " ").trim();
}

export function popularityFromHints(input: {
  term: string;
  foundAtPrefix: number | null;
  rankAtPrefix: number | null;
  inOwnHints: boolean;
  completions: number;
}) {
  const { term, foundAtPrefix, rankAtPrefix, inOwnHints, completions } = input;
  let base: number;
  if (foundAtPrefix === null) base = inOwnHints ? 14 : 5;
  else if (foundAtPrefix <= 1) base = 92;
  else if (foundAtPrefix === 2) base = 82;
  else if (foundAtPrefix === 3) base = 70;
  else if (foundAtPrefix === 4) base = 60;
  else if (foundAtPrefix <= 6) base = 50;
  else if (foundAtPrefix <= 9) base = 38;
  else if (foundAtPrefix < term.length) base = 28;
  else base = 18;
  const rankPenalty = (rankAtPrefix ?? 0) * 1.5;
  const tailBonus = foundAtPrefix === null ? 0 : Math.min(8, completions);
  return Math.round(clamp(base - rankPenalty + tailBonus, 5, 100));
}

function daysSince(date: string | undefined) {
  if (!date) return 3650;
  return Math.max(1, (Date.now() - new Date(date).getTime()) / 86400000);
}

export function titleMatch(app: Pick<StoreApp, "trackName">, term: string) {
  const title = normalizeTerm(app.trackName);
  const t = normalizeTerm(term);
  if (title.includes(t)) return 1;
  const words = t.split(" ").filter((w) => w.length > 1);
  if (!words.length) return 0;
  const hits = words.filter((w) => title.includes(w)).length;
  return hits / words.length;
}

export function estimateMonthlyDownloads(app: StoreApp, country: string) {
  const ageDays = daysSince(app.releaseDate);
  const ratingsPerDay = app.userRatingCount / Math.max(60, Math.min(ageDays, 1460));
  const recency = daysSince(app.currentVersionReleaseDate) < 120 ? 1.15 : 0.8;
  const perDay = ratingsPerDay * 55 * recency + 3 * marketSize(country);
  return Math.round(perDay * 30);
}

const GENRE_ARPD: Record<string, number> = {
  Games: 0.35, Productivity: 0.45, "Health & Fitness": 0.6, Education: 0.4, Photo: 0.4,
  "Photo & Video": 0.45, Utilities: 0.3, Lifestyle: 0.35, Business: 0.6, Finance: 0.3,
  Entertainment: 0.25, Music: 0.3, "Social Networking": 0.15, Reference: 0.35,
  "Graphics & Design": 0.5, Medical: 0.5, Navigation: 0.2, News: 0.1, Shopping: 0.02,
  Travel: 0.08, Sports: 0.15, Weather: 0.25, "Food & Drink": 0.1, Books: 0.3,
};

export function estimateMonthlyRevenue(app: StoreApp, downloads: number) {
  if (app.price > 0) return Math.round(downloads * app.price * 0.85);
  const arpd = GENRE_ARPD[app.primaryGenreName] ?? 0.2;
  const quality = clamp((app.averageUserRating - 3) / 2, 0.2, 1);
  return Math.round(downloads * arpd * quality);
}

export function appStrength(app: StoreApp) {
  const volume = clamp(Math.log10(app.userRatingCount + 1) / 5.5, 0, 1);
  const rating = clamp(app.averageUserRating / 5, 0, 1);
  const fresh = daysSince(app.currentVersionReleaseDate) < 90 ? 1 : daysSince(app.currentVersionReleaseDate) < 365 ? 0.6 : 0.2;
  return volume * 0.7 + rating * 0.15 + fresh * 0.15;
}

export function difficultyFromResults(results: StoreApp[], term: string) {
  const top = results.slice(0, 10);
  if (!top.length) return { score: 1, breakdown: { strength: 0, relevance: 0, saturation: 0 } };
  let weightSum = 0;
  let strength = 0;
  let relevance = 0;
  top.forEach((app, i) => {
    const w = 1 / (1 + 0.2 * i);
    weightSum += w;
    strength += appStrength(app) * w;
    relevance += (0.35 + 0.65 * titleMatch(app, term)) * w;
  });
  strength /= weightSum;
  relevance /= weightSum;
  const saturation = clamp(results.length / 150, 0.15, 1);
  const score = Math.round(clamp(100 * strength * (0.55 + 0.45 * relevance) * (0.6 + 0.4 * saturation) * 1.25, 1, 100));
  return {
    score,
    breakdown: {
      strength: Math.round(strength * 100),
      relevance: Math.round(relevance * 100),
      saturation: Math.round(saturation * 100),
    },
  };
}

export function monthlySearches(popularity: number, country: string) {
  return Math.round(Math.pow(10, 1 + popularity * 0.055) * marketSize(country));
}

const TAP_SHARE = [0.3, 0.15, 0.09, 0.06, 0.045, 0.035, 0.03, 0.025, 0.02, 0.018];

export function tapShare(position: number | null) {
  if (!position || position < 1) return 0;
  if (position <= 10) return TAP_SHARE[position - 1];
  if (position <= 25) return 0.01;
  if (position <= 50) return 0.003;
  return 0;
}

export function keywordDownloads(popularity: number, country: string, position: number | null) {
  return Math.round(monthlySearches(popularity, country) * tapShare(position) * 0.4);
}

export function opportunityScore(popularity: number, difficulty: number) {
  return Math.round(Math.sqrt(clamp(popularity, 0, 100) * clamp(100 - difficulty, 0, 100)));
}

export function targetingLabel(popularity: number, difficulty: number, position: number | null): TargetingLabel {
  if (difficulty >= 80) return "Very Competitive";
  if (position && position > 3 && position <= 30 && difficulty < 60 && popularity >= 25) return "Quick Win";
  if (popularity >= 45 && difficulty <= 45) return "Sweet Spot";
  if (popularity >= 60 && difficulty < 80) return "High Potential";
  if (popularity >= 20 && difficulty <= 30) return "Hidden Gem";
  if (popularity < 20) return "Low Volume";
  return "Competitive";
}

export const LABEL_TONE: Record<TargetingLabel, "green" | "teal" | "blue" | "purple" | "orange" | "red" | "neutral"> = {
  "Sweet Spot": "green",
  "Hidden Gem": "teal",
  "Quick Win": "blue",
  "High Potential": "purple",
  Competitive: "orange",
  "Very Competitive": "red",
  "Low Volume": "neutral",
};
