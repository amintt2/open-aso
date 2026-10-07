import { marketSize } from "@/lib/aso/scoring";
import { LIVE_POSITION, rawDailyInstalls, type ModelCountryInput, type Snapshot } from "./model";

export const IMPACT_DEMO_NOTICE = "Demo data — synthetic installs and revenue built around your tracked keywords. Connect PostHog or the Open ASO SDK, RevenueCat/Superwall and Apple Ads to calibrate on your real numbers.";

export type SourceKeyword = {
  key: string;
  keywordId: number | null;
  term: string;
  country: string;
  popularity: number | null;
  popularitySource: "apple" | "estimate" | null;
  position: number | null;
};

export type DemoInputs = {
  keywords: (SourceKeyword & { snapshots: Snapshot[]; paidInstalls: number; attributedRevenue: number | null })[];
  countries: ModelCountryInput[];
  appArpu: number;
  otherCountries: { observed: number; paid: number };
};

const FALLBACK: Omit<SourceKeyword, "key" | "keywordId">[] = [
  { term: "tally counter", country: "us", popularity: 58, popularitySource: "estimate", position: 6 },
  { term: "click counter", country: "us", popularity: 52, popularitySource: "estimate", position: 3 },
  { term: "counter", country: "us", popularity: 70, popularitySource: "estimate", position: 24 },
  { term: "tap counter", country: "gb", popularity: 41, popularitySource: "estimate", position: 2 },
  { term: "compteur", country: "fr", popularity: 47, popularitySource: "estimate", position: 9 },
];

const ARPU: Record<string, number> = { us: 0.9, gb: 0.75, de: 0.7, ca: 0.7, au: 0.7, ch: 0.85, fr: 0.55, jp: 0.8 };

function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function rng(seed: string) {
  let a = hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function integerize(values: number[]) {
  let carry = 0;
  return values.map((v) => {
    const total = v + carry;
    const n = Math.max(0, Math.round(total));
    carry = total - n;
    return n;
  });
}

function weekday(date: string) {
  const d = new Date(`${date}T00:00:00Z`).getUTCDay();
  return d === 0 || d === 6 ? 1.12 : d === 1 ? 0.95 : 1;
}

function walk(dates: readonly string[], current: number | null, random: () => number) {
  const out: (number | null)[] = new Array(dates.length);
  let p = current;
  for (let i = dates.length - 1; i >= 0; i--) {
    out[i] = p;
    if (p != null && p <= LIVE_POSITION) {
      const step = Math.round((random() - 0.5) * (p > 10 ? 4 : 2));
      p = Math.min(LIVE_POSITION + 10, Math.max(1, p + step));
    }
  }
  return out;
}

export function demoKeywords(tracked: SourceKeyword[]): SourceKeyword[] {
  if (tracked.length) return tracked;
  return FALLBACK.map((k, i) => ({ ...k, key: `demo-${i}`, keywordId: null }));
}

export function demoInputs(seed: string, dates: readonly string[], searchShare: number, tracked: SourceKeyword[]): DemoInputs {
  const random = rng(seed);
  const n = dates.length;
  const keywords = demoKeywords(tracked).map((k) => {
    const positions = walk(dates, k.position, random);
    const snapshots: Snapshot[] = dates
      .map((date, i) => ({ date, position: positions[i], popularity: k.popularity }))
      .filter((_, i) => i % 3 === 0 || i === n - 1);
    const raw = positions.map((p) => rawDailyInstalls(k.popularity, k.country, p));
    return { ...k, snapshots, raw, paidInstalls: 0, attributedRevenue: null as number | null };
  });
  const countryCodes = [...new Set(keywords.map((k) => k.country))];
  const rawTotal = (k: { raw: number[] }) => k.raw.reduce((x, y) => x + y, 0);
  const lead = [...keywords].filter((k) => rawTotal(k) > 0).sort((a, b) => rawTotal(b) - rawTotal(a))[0];
  const countries: ModelCountryInput[] = [];
  let otherObserved = 0;
  let revenueTotal = 0;
  let observedTotal = 0;
  for (const country of countryCodes) {
    const list = keywords.filter((k) => k.country === country);
    const target = 0.8 + random() * 1.4;
    const base = marketSize(country) * 3 + 0.3;
    const organic = integerize(
      dates.map((date, i) => {
        const raw = list.reduce((s, k) => s + k.raw[i], 0);
        return ((raw * target) / searchShare + base) * weekday(date) * (0.85 + random() * 0.3);
      }),
    );
    const paidRaw = lead && lead.country === country ? lead.raw.map((v) => v * 0.6 * (0.7 + random() * 0.6) + 0.4) : dates.map(() => 0);
    const paid = integerize(paidRaw);
    const observed = organic.map((v, i) => v + paid[i]);
    const total = observed.reduce((a, b) => a + b, 0);
    const arpu = (ARPU[country] ?? 0.45) * (0.85 + random() * 0.3);
    const revenue = Math.round(total * arpu * 100) / 100;
    if (lead && lead.country === country) {
      lead.paidInstalls = paid.reduce((a, b) => a + b, 0);
      lead.attributedRevenue = Math.round(lead.paidInstalls * arpu * 1.15 * 100) / 100;
    }
    countries.push({ country, observed, paid, revenue });
    observedTotal += total;
    revenueTotal += revenue;
  }
  otherObserved = Math.round(observedTotal * 0.3);
  revenueTotal += otherObserved * 0.4;
  observedTotal += otherObserved;
  return {
    keywords: keywords.map((k) => ({
      key: k.key,
      keywordId: k.keywordId,
      term: k.term,
      country: k.country,
      popularity: k.popularity,
      popularitySource: k.popularitySource,
      position: k.position,
      snapshots: k.snapshots,
      paidInstalls: k.paidInstalls,
      attributedRevenue: k.attributedRevenue,
    })),
    countries,
    appArpu: observedTotal > 0 ? revenueTotal / observedTotal : 0.5,
    otherCountries: { observed: otherObserved, paid: 0 },
  };
}
