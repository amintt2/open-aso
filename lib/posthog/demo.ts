import { funnelSteps } from "./hogql";
import type { RoleMap } from "./types";

export const POSTHOG_DEMO_NOTICE = "Demo data — a synthetic PostHog project with three apps. Connect PostHog to see your own events.";

type Ev = { t: number; e: string; d: string; c: string | null; city: string | null; v: string; lib: string; flag?: string; variant?: string };

type Names = {
  firstOpen: string;
  open: string;
  obStart: string;
  obStep: string | null;
  obExtra: string | null;
  obDone: string;
  paywall: string;
  pStart: string;
  pDone: string;
  pCancel: string;
  features: string[];
  lifecycle: boolean;
};

type DemoAppConfig = {
  slug: string;
  name: string;
  bundleId: string;
  prefix: string;
  lib: string;
  perDay: number;
  names: Names;
  experiment: { event: "$feature_flag_called" | "$experiment_exposure"; flag: string; variants: [string, number][]; lever: "purchase" | "onboarding" | "paywall" } | null;
  versions: [string, number][];
  wheel: boolean;
};

export const DEMO_APPS: DemoAppConfig[] = [
  {
    slug: "tappy",
    name: "Tappy",
    bundleId: "com.tappy.counter",
    prefix: "tappy",
    lib: "posthog-react-native",
    perDay: 24,
    names: {
      firstOpen: "tappy.first_open",
      open: "tappy.app_opened",
      obStart: "tappy.onboarding_started",
      obStep: "tappy.onboarding_step_viewed",
      obExtra: "tappy.onboarding_style_picked",
      obDone: "tappy.onboarding_completed",
      paywall: "tappy.paywall_viewed",
      pStart: "tappy.purchase_started",
      pDone: "tappy.purchase_completed",
      pCancel: "tappy.purchase_cancelled",
      features: ["tappy.counter_reset"],
      lifecycle: true,
    },
    experiment: { event: "$feature_flag_called", flag: "paywall-copy", variants: [["control", 1], ["test", 1.4]], lever: "purchase" },
    versions: [["2.3.0", 0], ["2.4.0", 45], ["2.4.1", 70], ["2.5.0", 104]],
    wheel: true,
  },
  {
    slug: "scrollworthy",
    name: "Scrollworthy",
    bundleId: "app.scrollworthy.ios",
    prefix: "scrollworthy",
    lib: "posthog-ios",
    perDay: 14,
    names: {
      firstOpen: "scrollworthy.app.first_open",
      open: "scrollworthy.app.opened",
      obStart: "scrollworthy.onboarding.started",
      obStep: null,
      obExtra: null,
      obDone: "scrollworthy.onboarding.completed",
      paywall: "scrollworthy.paywall.viewed",
      pStart: "scrollworthy.purchase.started",
      pDone: "scrollworthy.purchase.succeeded",
      pCancel: "scrollworthy.purchase.cancelled",
      features: ["scrollworthy.app.backgrounded", "scrollworthy.feed.scrolled"],
      lifecycle: false,
    },
    experiment: { event: "$experiment_exposure", flag: "onboarding-length", variants: [["control", 1], ["short", 1.18]], lever: "onboarding" },
    versions: [["1.8.0", 0], ["1.9.0", 60], ["1.9.2", 96]],
    wheel: false,
  },
  {
    slug: "carlog",
    name: "CarLog",
    bundleId: "com.carlog.app",
    prefix: "carlog",
    lib: "posthog-ios",
    perDay: 8,
    names: {
      firstOpen: "carlog.app.first_open",
      open: "carlog.app.opened",
      obStart: "carlog.onboarding.started",
      obStep: "carlog.onboarding.step_viewed",
      obExtra: null,
      obDone: "carlog.onboarding.finished",
      paywall: "carlog.paywall.shown",
      pStart: "carlog.purchase.started",
      pDone: "carlog.subscription.started",
      pCancel: "carlog.purchase.canceled",
      features: ["carlog.vehicle.suggested", "$screen"],
      lifecycle: false,
    },
    experiment: { event: "$feature_flag_called", flag: "garage-redesign", variants: [["false", 1], ["true", 1.1]], lever: "paywall" },
    versions: [["3.0.0", 0], ["3.1.0", 82]],
    wheel: false,
  },
];

export type DemoSlug = (typeof DEMO_APPS)[number]["slug"];

export function demoApp(slug: string | null | undefined) {
  return DEMO_APPS.find((a) => a.slug === slug) ?? DEMO_APPS[0];
}

const COUNTRIES: { code: string; weight: number; cities: string[] }[] = [
  { code: "US", weight: 34, cities: ["New York", "Los Angeles", "Chicago", "Austin", "Seattle"] },
  { code: "GB", weight: 9, cities: ["London", "Manchester"] },
  { code: "DE", weight: 8, cities: ["Berlin", "Munich", "Hamburg"] },
  { code: "FR", weight: 7, cities: ["Paris", "Lyon"] },
  { code: "CA", weight: 6, cities: ["Toronto", "Vancouver"] },
  { code: "BR", weight: 6, cities: ["São Paulo", "Rio de Janeiro"] },
  { code: "IN", weight: 6, cities: ["Mumbai", "Bengaluru"] },
  { code: "JP", weight: 5, cities: ["Tokyo", "Osaka"] },
  { code: "AU", weight: 4, cities: ["Sydney", "Melbourne"] },
  { code: "ES", weight: 3, cities: ["Madrid", "Barcelona"] },
  { code: "MX", weight: 3, cities: ["Mexico City"] },
  { code: "IT", weight: 3, cities: ["Milan", "Rome"] },
  { code: "NL", weight: 2, cities: ["Amsterdam"] },
  { code: "KR", weight: 2, cities: ["Seoul"] },
  { code: "SE", weight: 2, cities: ["Stockholm"] },
];

const DAY = 86400000;
const DAYS = 125;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function poisson(rand: () => number, lambda: number) {
  const l = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rand();
  } while (p > l);
  return k - 1;
}

function pickWeighted<T>(rand: () => number, items: T[], weight: (item: T) => number) {
  const total = items.reduce((a, b) => a + weight(b), 0);
  let x = rand() * total;
  for (const item of items) {
    x -= weight(item);
    if (x <= 0) return item;
  }
  return items[items.length - 1];
}

function dayStart(t: number) {
  return Math.floor(t / DAY) * DAY;
}

function buildApp(cfg: DemoAppConfig, seed: number, now: number): Ev[] {
  const rand = rng(seed);
  const out: Ev[] = [];
  const first = dayStart(now) - (DAYS - 1) * DAY;
  const n = cfg.names;
  const versionAt = (t: number) => {
    const idx = Math.floor((t - first) / DAY);
    let v = cfg.versions[0][0];
    for (const [version, from] of cfg.versions) if (idx >= from) v = version;
    return v;
  };
  let seq = 0;
  for (let i = 0; i < DAYS; i++) {
    const base = first + i * DAY;
    const weekday = new Date(base).getUTCDay();
    const trend = 0.75 + 0.5 * (i / DAYS);
    const count = poisson(rand, cfg.perDay * trend * (weekday === 0 || weekday === 6 ? 1.2 : 1));
    for (let u = 0; u < count; u++) {
      const t0 = base + Math.floor(rand() * DAY * 0.96);
      if (t0 > now) continue;
      const country = pickWeighted(rand, COUNTRIES, (c) => c.weight);
      const city = rand() < 0.85 ? country.cities[Math.floor(rand() * country.cities.length)] : null;
      const d = `${cfg.slug.slice(0, 2)}${(seed % 97).toString(16)}${(++seq).toString(36).padStart(5, "0")}-${Math.floor(rand() * 1e8).toString(16)}`;
      let version = versionAt(t0);
      const push = (e: string, t: number, extra?: Partial<Ev>) => {
        if (t <= now) out.push({ t, e, d, c: country.code, city, v: version, lib: cfg.lib, ...extra });
      };
      const variant = cfg.experiment ? pickWeighted(rand, cfg.experiment.variants, () => 1) : null;
      const lift = (lever: string) => (cfg.experiment && variant && cfg.experiment.lever === lever ? variant[1] : 1);
      push(n.firstOpen, t0);
      if (n.lifecycle) {
        push("Application Installed", t0 - 400);
        push("Application Opened", t0 - 200);
      }
      if (cfg.experiment && variant) push(cfg.experiment.event, t0 + 1500, { flag: cfg.experiment.flag, variant: variant[0] });
      let t = t0 + 4000;
      let completed = false;
      if (rand() < 0.86) {
        push(n.obStart, t);
        for (let s = 0; s < 3; s++) {
          t += 6000 + Math.floor(rand() * 9000);
          if (n.obStep) push(n.obStep, t);
          if (rand() < 0.07) break;
        }
        if (n.obExtra && rand() < 0.8) push(n.obExtra, (t += 5000));
        if (rand() < Math.min(0.95, 0.68 * lift("onboarding"))) {
          push(n.obDone, (t += 4000));
          completed = true;
        }
      }
      const sawPaywall = rand() < Math.min(0.97, (completed ? 0.84 : 0.22) * lift("paywall"));
      if (sawPaywall) {
        push(n.paywall, (t += 3000));
        if (rand() < Math.min(0.6, 0.17 * lift("purchase"))) {
          push(n.pStart, (t += 9000));
          if (rand() < 0.56) push(n.pDone, (t += 14000));
          else {
            push(n.pCancel, (t += 8000));
            if (cfg.wheel) {
              push("tappy.wheel_shown", (t += 2000));
              if (rand() < 0.7) push("tappy.wheel_spun", (t += 3000));
              push("tappy.wheel_offer_viewed", (t += 2000));
              if (rand() < 0.62) push("tappy.wheel_offer_declined", (t += 6000));
              else {
                push(n.pStart, (t += 5000));
                if (rand() < 0.5) push(n.pDone, (t += 12000));
              }
            }
          }
        }
      }
      const engagement = 0.7 + rand() * 0.7;
      for (let k = 1; k <= 60; k++) {
        const at = dayStart(t0) + k * DAY + Math.floor(rand() * DAY * 0.9);
        if (at > now) break;
        if (rand() >= Math.min(0.9, 0.42 * Math.pow(k, -0.5) * engagement)) continue;
        if (version !== versionAt(at) && rand() < 0.75) version = versionAt(at);
        if (n.lifecycle) push("Application Opened", at - 100);
        push(n.open, at);
        const actions = 1 + Math.floor(rand() * 3);
        for (let a = 0; a < actions; a++) push(n.features[Math.floor(rand() * n.features.length)], at + (a + 1) * 20000);
        if (rand() < 0.08) push(n.paywall, at + 90000);
      }
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

type DemoCache = { key: string; now: number; apps: Map<string, Ev[]> };
type GlobalWithDemo = typeof globalThis & { __openAsoPosthogDemo?: DemoCache };

function demoData() {
  const g = globalThis as GlobalWithDemo;
  const now = Date.now();
  const key = new Date(now).toISOString().slice(0, 13);
  if (g.__openAsoPosthogDemo?.key === key) return g.__openAsoPosthogDemo;
  const apps = new Map(DEMO_APPS.map((cfg, i) => [cfg.slug, buildApp(cfg, 20261007 + i * 7919, now)]));
  g.__openAsoPosthogDemo = { key, now, apps };
  return g.__openAsoPosthogDemo;
}

function ctx(slug: string, days: number) {
  const data = demoData();
  const events = data.apps.get(demoApp(slug).slug) ?? [];
  const start = dayStart(data.now) - (days - 1) * DAY;
  return { now: data.now, events, start, inWindow: events.filter((e) => e.t >= start) };
}

const iso = (t: number) => new Date(t).toISOString();
const isoDay = (t: number) => iso(t).slice(0, 10);

function group<K>(events: Ev[], key: (e: Ev) => K) {
  const map = new Map<K, Ev[]>();
  for (const e of events) {
    const k = key(e);
    const list = map.get(k);
    if (list) list.push(e);
    else map.set(k, [e]);
  }
  return map;
}

function uniqUsers(events: Ev[], filter: (e: Ev) => boolean = () => true) {
  const s = new Set<string>();
  for (const e of events) if (filter(e)) s.add(e.d);
  return s.size;
}

export function demoFetchedAt() {
  return iso(demoData().now);
}

export function demoCatalogRows(slug: string, days = 90) {
  const { inWindow } = ctx(slug, days);
  return [...group(inWindow, (e) => e.e).entries()].map(([event, list]) => ({ event, total: list.length, users: uniqUsers(list) })).sort((a, b) => b.total - a.total);
}

export function demoOverviewDailyRows(slug: string, roles: RoleMap, days: number) {
  const { inWindow } = ctx(slug, days);
  const install = new Set(roles.install);
  return [...group(inWindow, (e) => isoDay(e.t)).entries()].map(([day, list]) => ({ day, new_users: uniqUsers(list, (e) => install.has(e.e)), dau: uniqUsers(list), total: list.length }));
}

export function demoOverviewTotalsRows(slug: string, roles: RoleMap, days: number) {
  const { inWindow, now } = ctx(slug, days * 2);
  const current = ctx(slug, days).start;
  const install = new Set(roles.install);
  const weekAgo = now - 7 * DAY;
  return [
    {
      new_users: uniqUsers(inWindow, (e) => install.has(e.e) && e.t >= current),
      previous_new_users: uniqUsers(inWindow, (e) => install.has(e.e) && e.t < current),
      active_users: uniqUsers(inWindow, (e) => e.t >= current),
      wau: uniqUsers(inWindow, (e) => e.t >= weekAgo),
      total: inWindow.filter((e) => e.t >= current).length,
      previous_total: inWindow.filter((e) => e.t < current).length,
    },
  ];
}

export function demoTopEventsRows(slug: string, days: number) {
  return demoCatalogRows(slug, days).slice(0, 50);
}

export function demoFunnelRows(slug: string, roles: RoleMap, days: number) {
  const { inWindow } = ctx(slug, days);
  const steps = funnelSteps(roles);
  const sets = steps.map((role) => new Set(roles[role]));
  const startSet = new Set(roles.purchase_start);
  const cancelSet = new Set(roles.purchase_cancel);
  const counts = steps.map(() => 0);
  let started = 0;
  let cancelled = 0;
  for (const list of group(inWindow, (e) => e.d).values()) {
    const firstStep = list.find((e) => sets[0].has(e.e));
    if (!firstStep) continue;
    let t = firstStep.t;
    counts[0]++;
    for (let i = 1; i < steps.length; i++) {
      const next = list.find((e) => sets[i].has(e.e) && e.t >= t);
      if (!next) break;
      t = next.t;
      counts[i]++;
    }
    const s = list.find((e) => startSet.has(e.e));
    if (s) {
      started++;
      if (list.some((e) => cancelSet.has(e.e) && e.t >= s.t)) cancelled++;
    }
  }
  return [{ ...Object.fromEntries(counts.map((c, i) => [`s${i}`, c])), purchase_started: started, purchase_cancelled: cancelled }];
}

function startOfWeekMonday(day: string) {
  const t = Date.parse(`${day}T00:00:00Z`);
  const wd = (new Date(t).getUTCDay() + 6) % 7;
  return isoDay(t - wd * DAY);
}

export function demoRetentionRows(slug: string, roles: RoleMap, days: number, weekly: boolean) {
  const { inWindow, now } = ctx(slug, days);
  const install = new Set(roles.install);
  const open = new Set(roles.open);
  const today = isoDay(now);
  const add = (day: string, n: number) => isoDay(Date.parse(`${day}T00:00:00Z`) + n * DAY);
  const cohorts = new Map<string, { users: number; e1: number; r1: number; e7: number; r7: number; e30: number; r30: number }>();
  for (const list of group(inWindow, (e) => e.d).values()) {
    const first = list.find((e) => install.has(e.e));
    if (!first) continue;
    const d0 = isoDay(first.t);
    const active = new Set(list.filter((e) => (open.size ? open.has(e.e) : true)).map((e) => isoDay(e.t)));
    const key = weekly ? startOfWeekMonday(d0) : d0;
    const row = cohorts.get(key) ?? { users: 0, e1: 0, r1: 0, e7: 0, r7: 0, e30: 0, r30: 0 };
    row.users++;
    for (const n of [1, 7, 30] as const) {
      const target = add(d0, n);
      if (target <= today) row[`e${n}`]++;
      if (active.has(target)) row[`r${n}`]++;
    }
    cohorts.set(key, row);
  }
  return [...cohorts.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([cohort, r]) => ({ cohort, ...r }));
}

export function demoCountriesRows(slug: string, roles: RoleMap, days: number) {
  const { inWindow } = ctx(slug, days);
  const install = new Set(roles.install);
  return [...group(inWindow, (e) => e.c ?? "").entries()]
    .map(([country, list]) => ({ country, new_users: uniqUsers(list, (e) => install.has(e.e)), active_users: uniqUsers(list) }))
    .sort((a, b) => b.new_users - a.new_users || b.active_users - a.active_users);
}

export function demoCitiesRows(slug: string, roles: RoleMap, days: number) {
  const { inWindow } = ctx(slug, days);
  const install = new Set(roles.install);
  return [...group(
    inWindow.filter((e) => e.city),
    (e) => `${e.city}|${e.c ?? ""}`,
  ).entries()]
    .map(([key, list]) => ({ city: key.split("|")[0], country: key.split("|")[1], new_users: uniqUsers(list, (e) => install.has(e.e)), active_users: uniqUsers(list) }))
    .sort((a, b) => b.new_users - a.new_users || b.active_users - a.active_users)
    .slice(0, 25);
}

export function demoVersionsRows(slug: string, roles: RoleMap, days: number) {
  const { inWindow } = ctx(slug, days);
  const install = new Set(roles.install);
  return [...group(inWindow, (e) => e.v).entries()].map(([version, list]) => ({
    version,
    users: uniqUsers(list),
    new_users: uniqUsers(list, (e) => install.has(e.e)),
    total: list.length,
    first_seen: iso(list[0].t),
    last_seen: iso(list[list.length - 1].t),
  }));
}

export function demoExperimentsRows(slug: string, roles: RoleMap, days: number) {
  const { inWindow } = ctx(slug, days);
  const paywall = new Set(roles.paywall_view);
  const purchase = new Set(roles.purchase_success);
  const rows = new Map<string, { flag: string; variant: string; users: number; paywall_users: number; purchase_users: number }>();
  for (const list of group(inWindow, (e) => e.d).values()) {
    const exposures = new Map<string, Ev>();
    for (const e of list) if (e.flag && !exposures.has(e.flag)) exposures.set(e.flag, e);
    for (const [flag, ex] of exposures) {
      const key = `${flag}|${ex.variant ?? ""}`;
      const row = rows.get(key) ?? { flag, variant: ex.variant ?? "", users: 0, paywall_users: 0, purchase_users: 0 };
      row.users++;
      if (list.some((e) => paywall.has(e.e) && e.t >= ex.t)) row.paywall_users++;
      if (list.some((e) => purchase.has(e.e) && e.t >= ex.t)) row.purchase_users++;
      rows.set(key, row);
    }
  }
  return [...rows.values()].sort((a, b) => b.users - a.users);
}

export function demoLiveRows(slug: string) {
  const { events } = ctx(slug, 7);
  const cfg = demoApp(slug);
  return events
    .slice(-100)
    .reverse()
    .map((e) => ({ timestamp: iso(e.t), event: e.e, distinct_id: e.d, lib: cfg.lib, country: e.c, version: e.v }));
}

export function demoNewUsersRows(slug: string, roles: RoleMap, days: number, country: string | null) {
  const { inWindow } = ctx(slug, days);
  const install = new Set(roles.install);
  const filtered = inWindow.filter((e) => install.has(e.e) && (!country || e.c === country.toUpperCase()));
  return [...group(filtered, (e) => isoDay(e.t)).entries()].map(([day, list]) => ({ day, new_users: uniqUsers(list) }));
}
