import { getApp, listVersions } from "@/lib/aso/apps";
import { HttpError } from "@/lib/server/http";
import { appCatalog, buildCatalog, listMappings } from "./apps";
import { isoDate, isoTime, MINUTE, num, QUERY_TTL, requireCredentials, runHogQL, text, type QueryResult } from "./client";
import { canonicalEvent, roleEvents, roleOf } from "./events";
import {
  demoApp,
  demoCatalogRows,
  demoCitiesRows,
  demoCountriesRows,
  demoExperimentsRows,
  demoFetchedAt,
  demoFunnelRows,
  demoLiveRows,
  demoNewUsersRows,
  demoOverviewDailyRows,
  demoOverviewTotalsRows,
  demoRetentionRows,
  demoTopEventsRows,
  demoVersionsRows,
  POSTHOG_DEMO_NOTICE,
} from "./demo";
import {
  citiesQuery,
  countriesQuery,
  experimentsQuery,
  FUNNEL_ROLES,
  funnelQuery,
  funnelSteps,
  liveEventsQuery,
  newUsersQuery,
  overviewDailyQuery,
  overviewTotalsQuery,
  retentionQuery,
  topEventsQuery,
  versionsQuery,
  type AppScope,
  type HogQL,
} from "./hogql";
import {
  EVENT_ROLES,
  ROLE_LABELS,
  type EventRole,
  type ExperimentRow,
  type NewUsersPoint,
  type PosthogApp,
  type PosthogEventsResult,
  type PosthogExperimentsResult,
  type PosthogFunnelResult,
  type PosthogGeographyResult,
  type PosthogMeta,
  type PosthogNewUsersResult,
  type PosthogOverviewResult,
  type PosthogRetentionResult,
  type PosthogVersionsResult,
  type RoleMap,
} from "./types";

export type * from "./types";

export type PosthogQuery = { appId?: number | null; days?: number; demo?: string | boolean | null; refresh?: boolean };

type Row = Record<string, unknown>;

const DAY_MS = 86400000;
const LIVE_TTL = MINUTE;

export function posthogDays(value: unknown) {
  const n = Number(value);
  return [7, 30, 90].includes(n) ? n : 30;
}

function isoDay(t: number) {
  return new Date(t).toISOString().slice(0, 10);
}

function dateRange(from: string, to: string) {
  const out: string[] = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += DAY_MS) out.push(isoDay(t));
  return out;
}

function ratio(a: number, b: number) {
  return b > 0 ? a / b : null;
}

function emptyRoles(): RoleMap {
  return Object.fromEntries(EVENT_ROLES.map((role) => [role, [] as string[]])) as RoleMap;
}

type Source = {
  demo: boolean;
  slug: string | null;
  app: PosthogApp;
  scope: AppScope;
  roles: RoleMap;
  days: number;
  refresh: boolean;
  results: { fetchedAt: string; cached: boolean }[];
  run: (q: HogQL, demoRows: (slug: string) => Row[], ttlMs?: number) => Promise<Row[]>;
};

async function source(q: PosthogQuery): Promise<Source> {
  const days = posthogDays(q.days);
  const refresh = !!q.refresh;
  const results: Source["results"] = [];
  if (q.demo) {
    const cfg = demoApp(typeof q.demo === "string" ? q.demo : null);
    const app: PosthogApp = { id: null, name: cfg.name, bundleId: cfg.bundleId, prefix: cfg.prefix, demoSlug: cfg.slug };
    const catalog = buildCatalog(
      app,
      demoCatalogRows(cfg.slug).map((r) => ({ event: r.event, count: r.total, users: r.users })),
      {},
      demoFetchedAt(),
      false,
    );
    return {
      demo: true,
      slug: cfg.slug,
      app,
      scope: { bundleId: cfg.bundleId, prefix: cfg.prefix },
      roles: roleEvents(catalog.roles),
      days,
      refresh,
      results,
      run: async (_q, demoRows) => {
        results.push({ fetchedAt: demoFetchedAt(), cached: false });
        return demoRows(cfg.slug);
      },
    };
  }
  if (!q.appId) throw new HttpError(400, "Choose an app to see its PostHog analytics");
  requireCredentials();
  const catalog = await appCatalog(q.appId, { refresh });
  results.push({ fetchedAt: catalog.fetchedAt, cached: catalog.cached });
  return {
    demo: false,
    slug: null,
    app: catalog.app,
    scope: { bundleId: catalog.app.bundleId, prefix: catalog.app.prefix },
    roles: roleEvents(catalog.roles),
    days,
    refresh,
    results,
    run: async (hogql, _demo, ttlMs = QUERY_TTL) => {
      const res: QueryResult<Row> = await runHogQL<Row>(hogql, { refresh, ttlMs });
      results.push({ fetchedAt: res.fetchedAt, cached: res.cached });
      return res.rows;
    },
  };
}

function meta(s: Source): PosthogMeta {
  const to = isoDay(Date.now());
  const from = isoDay(Date.now() - (s.days - 1) * DAY_MS);
  const fetchedAt = s.results.reduce((min, r) => (r.fetchedAt < min ? r.fetchedAt : min), new Date().toISOString());
  return {
    demo: s.demo,
    notice: s.demo ? POSTHOG_DEMO_NOTICE : null,
    app: s.app,
    days: s.days,
    from,
    to,
    fetchedAt,
    cached: s.results.length > 0 && s.results.every((r) => r.cached),
    roles: s.roles,
  };
}

function seriesDays(m: PosthogMeta, days: (string | null)[]) {
  const last = days.reduce<string>((max, d) => (d && d > max ? d : max), m.to);
  return dateRange(isoDay(Date.parse(`${last}T00:00:00Z`) - (m.days - 1) * DAY_MS), last);
}

function shortId(id: string) {
  return id.length > 14 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
}

function country(value: unknown) {
  const v = text(value)?.trim().toLowerCase();
  return v && /^[a-z]{2}$/.test(v) ? v : "??";
}

export async function getPosthogOverview(q: PosthogQuery): Promise<PosthogOverviewResult> {
  const s = await source(q);
  const [daily, totals, top] = await Promise.all([
    s.run(overviewDailyQuery(s.scope, s.roles, s.days), (slug) => demoOverviewDailyRows(slug, s.roles, s.days)),
    s.run(overviewTotalsQuery(s.scope, s.roles, s.days), (slug) => demoOverviewTotalsRows(slug, s.roles, s.days)),
    s.run(topEventsQuery(s.scope, s.days), (slug) => demoTopEventsRows(slug, s.days)),
  ]);
  const m = meta(s);
  const byDay = new Map(daily.map((r) => [isoDate(r.day), r]));
  const series = seriesDays(m, [...byDay.keys()]).map((date) => {
    const r = byDay.get(date);
    return { date, newUsers: num(r?.new_users), dau: num(r?.dau), events: num(r?.total) };
  });
  const t = totals[0] ?? {};
  return {
    ...m,
    totals: {
      newUsers: num(t.new_users),
      previousNewUsers: num(t.previous_new_users),
      activeUsers: num(t.active_users),
      dauAverage: series.length ? series.reduce((a, p) => a + p.dau, 0) / series.length : 0,
      wau: num(t.wau),
      events: num(t.total),
      previousEvents: num(t.previous_total),
    },
    series,
    topEvents: top.map((r) => {
      const event = text(r.event) ?? "";
      return { event, canonical: canonicalEvent(event, s.app.prefix), role: roleOf(event, s.roles), count: num(r.total), users: num(r.users) };
    }),
  };
}

export async function getPosthogFunnel(q: PosthogQuery): Promise<PosthogFunnelResult> {
  const s = await source(q);
  const steps = funnelSteps(s.roles);
  const missing = [...FUNNEL_ROLES, "purchase_cancel" as EventRole].filter((role) => !s.roles[role].length);
  if (!steps.length) return { ...meta(s), steps: [], cancel: { started: 0, cancelled: 0, rate: null }, missing };
  const [row = {}] = await s.run(funnelQuery(s.scope, s.roles, s.days), (slug) => demoFunnelRows(slug, s.roles, s.days));
  const counts = steps.map((_, i) => num(row[`s${i}`]));
  const started = num(row.purchase_started);
  const cancelled = num(row.purchase_cancelled);
  return {
    ...meta(s),
    steps: steps.map((role, i) => ({
      role,
      label: ROLE_LABELS[role],
      events: s.roles[role],
      users: counts[i],
      fromStart: ratio(counts[i], counts[0]),
      fromPrevious: i === 0 ? null : ratio(counts[i], counts[i - 1]),
      dropOff: i === 0 ? 0 : Math.max(0, counts[i - 1] - counts[i]),
    })),
    cancel: { started, cancelled, rate: s.roles.purchase_cancel.length ? ratio(cancelled, started) : null },
    missing,
  };
}

export async function getPosthogRetention(q: PosthogQuery): Promise<PosthogRetentionResult> {
  const s = await source(q);
  const weekly = s.days > 7;
  const missing = (["install", "open"] as EventRole[]).filter((role) => !s.roles[role].length);
  const base = { granularity: weekly ? ("week" as const) : ("day" as const), activity: s.roles.open.length ? ("open" as const) : ("any" as const), missing };
  if (!s.roles.install.length) return { ...meta(s), ...base, cohorts: [], average: { d1: null, d7: null, d30: null } };
  const rows = await s.run(retentionQuery(s.scope, s.roles, s.days, weekly), (slug) => demoRetentionRows(slug, s.roles, s.days, weekly));
  const cohorts = rows.map((r) => ({
    cohort: isoDate(r.cohort) ?? "",
    users: num(r.users),
    d1: ratio(num(r.r1), num(r.e1)),
    d7: ratio(num(r.r7), num(r.e7)),
    d30: ratio(num(r.r30), num(r.e30)),
    eligible: { d1: num(r.e1), d7: num(r.e7), d30: num(r.e30) },
  }));
  const sum = (k: string) => rows.reduce((acc, r) => acc + num(r[k]), 0);
  return { ...meta(s), ...base, cohorts, average: { d1: ratio(sum("r1"), sum("e1")), d7: ratio(sum("r7"), sum("e7")), d30: ratio(sum("r30"), sum("e30")) } };
}

export async function getPosthogGeography(q: PosthogQuery): Promise<PosthogGeographyResult> {
  const s = await source(q);
  const [countries, cities] = await Promise.all([
    s.run(countriesQuery(s.scope, s.roles, s.days), (slug) => demoCountriesRows(slug, s.roles, s.days)),
    s.run(citiesQuery(s.scope, s.roles, s.days), (slug) => demoCitiesRows(slug, s.roles, s.days)),
  ]);
  return {
    ...meta(s),
    countries: countries.map((r) => ({ country: country(r.country), newUsers: num(r.new_users), activeUsers: num(r.active_users) })),
    cities: cities.map((r) => ({ city: text(r.city) ?? "", country: country(r.country) === "??" ? null : country(r.country), newUsers: num(r.new_users), activeUsers: num(r.active_users) })),
  };
}

function compareVersions(a: string, b: string) {
  const pa = a.split(/[.\-+]/).map((x) => Number(x));
  const pb = b.split(/[.\-+]/).map((x) => Number(x));
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = Number.isFinite(pa[i]) ? pa[i] : -1;
    const y = Number.isFinite(pb[i]) ? pb[i] : -1;
    if (x !== y) return y - x;
  }
  return b.localeCompare(a);
}

export async function getPosthogVersions(q: PosthogQuery): Promise<PosthogVersionsResult> {
  const s = await source(q);
  const rows = await s.run(versionsQuery(s.scope, s.roles, s.days), (slug) => demoVersionsRows(slug, s.roles, s.days));
  const releases = new Map<string, string>();
  if (!s.demo && s.app.id) for (const r of listVersions(getApp(s.app.id).trackId)) releases.set(r.version, r.releasedAt);
  return {
    ...meta(s),
    versions: rows
      .map((r) => {
        const version = text(r.version) ?? "unknown";
        return { version, users: num(r.users), newUsers: num(r.new_users), events: num(r.total), firstSeen: isoTime(r.first_seen), lastSeen: isoTime(r.last_seen), releasedAt: releases.get(version) ?? null };
      })
      .sort((a, b) => compareVersions(a.version, b.version)),
  };
}

export async function getPosthogExperiments(q: PosthogQuery): Promise<PosthogExperimentsResult> {
  const s = await source(q);
  const rows = await s.run(experimentsQuery(s.scope, s.roles, s.days), (slug) => demoExperimentsRows(slug, s.roles, s.days));
  const flags = new Map<string, ExperimentRow>();
  for (const r of rows) {
    const flag = text(r.flag) ?? "";
    const exp = flags.get(flag) ?? { flag, users: 0, variants: [] };
    const users = num(r.users);
    const paywallUsers = num(r.paywall_users);
    const purchaseUsers = num(r.purchase_users);
    exp.users += users;
    exp.variants.push({
      variant: text(r.variant) ?? "(none)",
      users,
      paywallUsers,
      purchaseUsers,
      paywallRate: s.roles.paywall_view.length ? ratio(paywallUsers, users) : null,
      purchaseRate: s.roles.purchase_success.length ? ratio(purchaseUsers, users) : null,
    });
    flags.set(flag, exp);
  }
  const experiments = [...flags.values()]
    .map((e) => ({ ...e, variants: e.variants.sort((a, b) => (a.variant === "control" ? -1 : b.variant === "control" ? 1 : a.variant.localeCompare(b.variant))) }))
    .sort((a, b) => b.users - a.users);
  return { ...meta(s), experiments };
}

export async function getPosthogEvents(q: PosthogQuery): Promise<PosthogEventsResult> {
  const s = await source(q);
  const rows = await s.run(liveEventsQuery(s.scope, s.days), (slug) => demoLiveRows(slug), LIVE_TTL);
  return {
    ...meta(s),
    events: rows.map((r) => {
      const event = text(r.event) ?? "";
      const c = country(r.country);
      return {
        timestamp: isoTime(r.timestamp) ?? "",
        event,
        canonical: canonicalEvent(event, s.app.prefix),
        role: roleOf(event, s.roles),
        distinctId: shortId(text(r.distinct_id) ?? ""),
        lib: text(r.lib),
        country: c === "??" ? null : c,
        version: text(r.version),
      };
    }),
  };
}

async function newUsersSeries(s: Source, days: number, countryCode: string | null) {
  const rows = await s.run(newUsersQuery(s.scope, s.roles, days, countryCode), (slug) => demoNewUsersRows(slug, s.roles, days, countryCode));
  return new Map(rows.map((r) => [isoDate(r.day) ?? "", num(r.new_users)]));
}

function cleanCountry(value: string | null | undefined) {
  const v = value?.trim().toLowerCase();
  if (!v) return null;
  if (!/^[a-z]{2}$/.test(v)) throw new HttpError(400, "country must be a two-letter code");
  return v;
}

function splitPeriods(values: Map<string, number>, days: number) {
  const to = isoDay(Date.now());
  const last = [...values.keys()].reduce((max, d) => (d > max ? d : max), to);
  const lastT = Date.parse(`${last}T00:00:00Z`);
  const current = dateRange(isoDay(lastT - (days - 1) * DAY_MS), last);
  const previous = dateRange(isoDay(lastT - (2 * days - 1) * DAY_MS), isoDay(lastT - days * DAY_MS));
  const series = current.map((date) => ({ date, newUsers: values.get(date) ?? 0 }));
  return { series, total: series.reduce((a, p) => a + p.newUsers, 0), previousTotal: previous.reduce((a, d) => a + (values.get(d) ?? 0), 0) };
}

export async function newUsersByDay(appId: number, days: number, country?: string | null): Promise<NewUsersPoint[]> {
  return (await getPosthogNewUsers({ appId, days }, country)).series;
}

export async function getPosthogNewUsers(q: PosthogQuery, countryCode?: string | null): Promise<PosthogNewUsersResult> {
  const days = posthogDays(q.days);
  const c = cleanCountry(countryCode);
  if (!q.demo && !q.appId) {
    requireCredentials();
    const totals = new Map<string, number>();
    const results: { fetchedAt: string; cached: boolean }[] = [];
    for (const mapping of listMappings()) {
      const s = await source({ ...q, appId: mapping.appId });
      for (const [day, n] of await newUsersSeries(s, days * 2, c)) totals.set(day, (totals.get(day) ?? 0) + n);
      results.push(...s.results);
    }
    const fetchedAt = results.reduce((min, r) => (r.fetchedAt < min ? r.fetchedAt : min), new Date().toISOString());
    return {
      demo: false,
      notice: null,
      app: { id: null, name: "All mapped apps", bundleId: null, prefix: null, demoSlug: null },
      days,
      from: isoDay(Date.now() - (days - 1) * DAY_MS),
      to: isoDay(Date.now()),
      fetchedAt,
      cached: results.length > 0 && results.every((r) => r.cached),
      roles: emptyRoles(),
      country: c,
      ...splitPeriods(totals, days),
    };
  }
  const s = await source(q);
  const values = s.roles.install.length ? await newUsersSeries(s, days * 2, c) : new Map<string, number>();
  return { ...meta(s), country: c, ...splitPeriods(values, days) };
}
