import type { TrafficDays, TrafficStepKey } from "@/lib/traffic/types";
import { splitCountries, sumSteps } from "./portfolio-math";
import type { PortfolioApp, PortfolioCountry, PortfolioKeyword, PortfolioMetric, PortfolioResult, PortfolioValue } from "./portfolio-types";

const DAY = 86400000;

type DemoApp = {
  name: string;
  downloads: number;
  growth: number;
  pageRate: number;
  downloadRate: number;
  openRate: number;
  trialRate: number;
  paidRate: number;
  price: number;
  searchShare: number;
  keywords: number;
  top10: number;
  reach: number;
  release: number;
  version: string;
  posthog: boolean;
  revenue: boolean;
  countries: Record<string, number>;
  terms: { term: string; country: string; position: number; popularity: number; share: number }[];
};

const APPS: DemoApp[] = [
  {
    name: "Tappy",
    downloads: 46,
    growth: 0.001,
    pageRate: 0.13,
    downloadRate: 0.36,
    openRate: 1.04,
    trialRate: 0.09,
    paidRate: 0.38,
    price: 14,
    searchShare: 0.42,
    keywords: 214,
    top10: 31,
    reach: 18.4,
    release: 9,
    version: "2.1.0",
    posthog: true,
    revenue: true,
    countries: { us: 0.34, gb: 0.1, de: 0.09, fr: 0.08, jp: 0.07, ca: 0.05, br: 0.05, au: 0.04, in: 0.04, it: 0.03, es: 0.03, nl: 0.02, mx: 0.02, kr: 0.02, se: 0.01, pl: 0.01 },
    terms: [
      { term: "tally counter", country: "us", position: 4, popularity: 52, share: 0.3 },
      { term: "click counter", country: "us", position: 7, popularity: 44, share: 0.14 },
      { term: "zähler", country: "de", position: 3, popularity: 38, share: 0.1 },
      { term: "row counter", country: "gb", position: 2, popularity: 29, share: 0.07 },
    ],
  },
  {
    name: "Scrollworthy",
    downloads: 28,
    growth: 0.002,
    pageRate: 0.1,
    downloadRate: 0.31,
    openRate: 0.97,
    trialRate: 0.12,
    paidRate: 0.33,
    price: 22,
    searchShare: 0.33,
    keywords: 126,
    top10: 14,
    reach: 9.7,
    release: 17,
    version: "1.4.2",
    posthog: true,
    revenue: true,
    countries: { us: 0.41, gb: 0.12, ca: 0.08, au: 0.07, de: 0.06, fr: 0.05, nl: 0.04, se: 0.03, in: 0.05, br: 0.03, jp: 0.03, es: 0.03 },
    terms: [
      { term: "screen time", country: "us", position: 18, popularity: 61, share: 0.22 },
      { term: "doomscrolling", country: "us", position: 3, popularity: 31, share: 0.2 },
      { term: "app blocker", country: "gb", position: 11, popularity: 47, share: 0.09 },
    ],
  },
  {
    name: "CarLog",
    downloads: 17,
    growth: -0.001,
    pageRate: 0.15,
    downloadRate: 0.4,
    openRate: 1.01,
    trialRate: 0.07,
    paidRate: 0.42,
    price: 18,
    searchShare: 0.55,
    keywords: 88,
    top10: 19,
    reach: 22.1,
    release: 4,
    version: "1.0.3",
    posthog: true,
    revenue: false,
    countries: { us: 0.29, de: 0.17, gb: 0.11, fr: 0.09, au: 0.07, ca: 0.06, nl: 0.05, it: 0.04, es: 0.04, pl: 0.03, se: 0.03, mx: 0.02 },
    terms: [
      { term: "fahrtenbuch", country: "de", position: 6, popularity: 49, share: 0.26 },
      { term: "mileage tracker", country: "us", position: 14, popularity: 55, share: 0.18 },
      { term: "car logbook", country: "au", position: 2, popularity: 27, share: 0.12 },
    ],
  },
  {
    name: "Cheat Deck",
    downloads: 9,
    growth: 0.003,
    pageRate: 0.18,
    downloadRate: 0.44,
    openRate: 0,
    trialRate: 0,
    paidRate: 0,
    price: 0,
    searchShare: 0.61,
    keywords: 52,
    top10: 6,
    reach: 6.3,
    release: 2,
    version: "1.0.4",
    posthog: false,
    revenue: false,
    countries: { us: 0.46, gb: 0.1, br: 0.09, mx: 0.07, de: 0.06, fr: 0.05, ca: 0.05, in: 0.05, au: 0.04, es: 0.03 },
    terms: [
      { term: "gta 6 cheats", country: "us", position: 9, popularity: 58, share: 0.4 },
      { term: "cheat codes", country: "br", position: 5, popularity: 36, share: 0.15 },
    ],
  },
];

function noise(seed: number, i: number) {
  const x = Math.sin(seed * 9301 + i * 49297) * 233280;
  return x - Math.floor(x);
}

function dayValue(app: DemoApp, seed: number, index: number, weekday: number) {
  const weekend = weekday === 0 || weekday === 6 ? 1.18 : 1;
  return Math.max(0, Math.round(app.downloads * (1 + app.growth * index) * weekend * (0.8 + noise(seed, index) * 0.4)));
}

function build(app: DemoApp, seed: number, days: number, end: number): PortfolioApp {
  const lag = 2;
  const total = days * 2 + lag;
  const downloads: number[] = [];
  for (let i = 0; i < total; i++) downloads.push(dayValue(app, seed, i - days - lag, new Date(end - (total - 1 - i) * DAY).getUTCDay()));
  const sum = (list: number[], from: number, to: number) => list.slice(from, to).reduce((s, n) => s + n, 0);
  const metric = (scale: (d: number, i: number) => number) => downloads.map((d, i) => scale(d, i));
  const impressions = metric((d, i) => Math.round((d / (app.pageRate * app.downloadRate)) * (0.92 + noise(seed + 1, i) * 0.16)));
  const pageViews = metric((d, i) => Math.round((d / app.downloadRate) * (0.94 + noise(seed + 2, i) * 0.12)));
  const opens = metric((d, i) => Math.round(d * app.openRate * (0.9 + noise(seed + 3, i) * 0.2)));
  const trials = opens.map((o, i) => Math.round(o * app.trialRate * (0.7 + noise(seed + 4, i) * 0.6)));
  const purchases = trials.map((t, i) => Math.round(t * app.paidRate * (0.6 + noise(seed + 5, i) * 0.8)));
  const revenue = purchases.map((p) => Math.round(p * app.price * 100) / 100);
  const est = metric((d, i) => Math.round(d * app.searchShare * (0.55 + noise(seed + 6, Math.floor(i / 3)) * 0.2) * 10) / 10);
  const value = (list: number[], on: boolean, shift = 0): PortfolioValue => (on ? { value: Math.round(sum(list, total - shift - days, total - shift) * 100) / 100, previous: Math.round(sum(list, total - shift - 2 * days, total - shift - days) * 100) / 100 } : { value: null, previous: null });
  const steps: Record<TrafficStepKey, PortfolioValue> = {
    impressions: value(impressions, true, lag),
    pageViews: value(pageViews, true, lag),
    downloads: value(downloads, true, lag),
    firstOpens: value(opens, app.posthog),
    trials: value(trials, app.revenue),
    purchases: value(purchases, app.revenue),
    revenue: value(revenue, app.revenue),
  };
  const window = (list: number[], on: boolean, late = 0) => list.slice(total - days).map((n, i) => (on && i < days - late ? n : null));
  const series: Record<PortfolioMetric, (number | null)[]> = {
    downloads: window(downloads, true, lag),
    impressions: window(impressions, true, lag),
    firstOpens: window(opens, app.posthog),
    revenue: window(revenue, app.revenue),
    estSearch: window(est, true),
  };
  const ratio = (v: PortfolioValue, w: PortfolioValue, pick: "value" | "previous") => (v[pick] != null && w[pick] ? (v[pick] as number) / (w[pick] as number) : null);
  const recent = est.slice(-7);
  return {
    key: `demo-${seed}`,
    id: null,
    name: app.name,
    iconUrl: null,
    sources: { apple: "ok", posthog: app.posthog ? "ok" : "connect", revenue: app.revenue ? "ok" : "connect" },
    steps,
    series,
    conversion: { value: ratio(steps.downloads, steps.impressions, "value"), previous: ratio(steps.downloads, steps.impressions, "previous") },
    keywords: app.keywords,
    top10: app.top10,
    estPerDay: Math.round((recent.reduce((s, n) => s + n, 0) / recent.length) * 10) / 10,
    reach: app.reach,
    versions: app.release < days ? [{ version: app.version, date: new Date(end - app.release * DAY).toISOString().slice(0, 10) }] : [],
  };
}

export function demoPortfolio(days: TrafficDays): PortfolioResult {
  const end = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  const dates = Array.from({ length: days }, (_, i) => new Date(end - (days - 1 - i) * DAY).toISOString().slice(0, 10));
  const apps = APPS.map((app, i) => build(app, i + 1, days, end));
  const byCountry = new Map<string, PortfolioCountry>();
  APPS.forEach((app, i) => {
    const total = apps[i].steps.downloads.value ?? 0;
    for (const [country, share] of Object.entries(app.countries)) {
      const row = byCountry.get(country) ?? { country, total: 0, byApp: APPS.map(() => 0) };
      const n = Math.round(total * share);
      row.byApp[i] += n;
      row.total += n;
      byCountry.set(country, row);
    }
  });
  const keywords: PortfolioKeyword[] = APPS.flatMap((app, i) =>
    app.terms.map((t) => ({ id: null, app: app.name, term: t.term, country: t.country, position: t.position, popularity: t.popularity, estInstalls: Math.round((apps[i].estPerDay ?? 0) * t.share * 10) / 10 })),
  ).sort((a, b) => b.estInstalls - a.estInstalls);
  return {
    days,
    demo: true,
    from: dates[0],
    to: dates[dates.length - 1],
    dates,
    appleThrough: dates[dates.length - 3] ?? null,
    revenueProviders: ["revenuecat"],
    apps,
    steps: sumSteps(apps),
    ...splitCountries([...byCountry.values()]),
    keywords,
  };
}
