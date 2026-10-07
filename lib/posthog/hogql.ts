import type { EventRole, RoleMap } from "./types";

export type HogQL = { name: string; query: string; values: Record<string, string> };

export type AppScope = { bundleId: string | null; prefix: string | null };

export const FUNNEL_ROLES: EventRole[] = ["install", "onboarding_start", "onboarding_complete", "paywall_view", "purchase_start", "purchase_success"];

const EXPOSURES = "event IN ('$feature_flag_called', '$experiment_exposure')";
const NEVER = "0 = 1";

function int(n: number) {
  if (!Number.isInteger(n) || n < 0 || n > 3650) throw new Error(`Invalid day count ${n}`);
  return n;
}

class Params {
  readonly values: Record<string, string> = {};
  private index = 0;

  value(v: string) {
    const key = `p${this.index++}`;
    this.values[key] = v;
    return `{${key}}`;
  }

  in(expr: string, list: string[]) {
    const unique = [...new Set(list)];
    return unique.length ? `${expr} IN (${unique.map((v) => this.value(v)).join(", ")})` : NEVER;
  }
}

function since(days: number) {
  return `toStartOfDay(now()) - toIntervalDay(${int(days - 1)})`;
}

function windowed(days: number) {
  return `timestamp >= ${since(days)}`;
}

function appFilter(p: Params, scope: AppScope, lookbackDays: number) {
  if (scope.bundleId) return `properties.$app_namespace = ${p.value(scope.bundleId)}`;
  if (!scope.prefix) throw new Error("App mapping needs a bundle id or an event prefix");
  const prefix = p.value(`${scope.prefix}.`);
  return `(startsWith(event, ${prefix}) OR ((startsWith(event, '$') OR startsWith(event, 'Application ')) AND distinct_id IN (SELECT distinct_id FROM events WHERE startsWith(event, ${prefix}) AND ${windowed(lookbackDays)})))`;
}

function build(name: string, p: Params, query: string): HogQL {
  return { name: `open-aso ${name}`, query: query.replace(/\s+/g, " ").trim(), values: p.values };
}

export function connectionTestQuery(): HogQL {
  return build("connection test", new Params(), "SELECT count() AS total FROM events WHERE timestamp >= now() - toIntervalDay(1)");
}

export function discoverBundlesQuery(days = 30): HogQL {
  return build(
    "discover bundles",
    new Params(),
    `SELECT properties.$app_namespace AS bundle_id, argMax(properties.$app_name, timestamp) AS app_name, count() AS total, uniq(person_id) AS users, max(timestamp) AS last_seen
     FROM events
     WHERE timestamp >= now() - toIntervalDay(${int(days)}) AND isNotNull(properties.$app_namespace) AND properties.$app_namespace != ''
     GROUP BY bundle_id ORDER BY total DESC LIMIT 200`,
  );
}

export function discoverPrefixesQuery(days = 30): HogQL {
  return build(
    "discover prefixes",
    new Params(),
    `SELECT splitByChar('.', event)[1] AS prefix, count() AS total, uniq(person_id) AS users, max(timestamp) AS last_seen,
            argMax(properties.$app_namespace, timestamp) AS bundle_id, argMax(properties.$app_name, timestamp) AS app_name
     FROM events
     WHERE timestamp >= now() - toIntervalDay(${int(days)}) AND NOT startsWith(event, '$') AND event LIKE '_%.%'
     GROUP BY prefix ORDER BY total DESC LIMIT 200`,
  );
}

export function catalogQuery(scope: AppScope, days = 90): HogQL {
  const p = new Params();
  return build(
    "event catalog",
    p,
    `SELECT event, count() AS total, uniq(person_id) AS users
     FROM events
     WHERE ${appFilter(p, scope, days)} AND ${windowed(days)}
     GROUP BY event ORDER BY total DESC LIMIT 500`,
  );
}

export function overviewDailyQuery(scope: AppScope, roles: RoleMap, days: number): HogQL {
  const p = new Params();
  const app = appFilter(p, scope, days);
  return build(
    "overview daily",
    p,
    `SELECT toDate(timestamp) AS day, uniqIf(person_id, ${p.in("event", roles.install)}) AS new_users, uniq(person_id) AS dau, count() AS total
     FROM events
     WHERE ${app} AND ${windowed(days)}
     GROUP BY day ORDER BY day ASC LIMIT 400`,
  );
}

export function overviewTotalsQuery(scope: AppScope, roles: RoleMap, days: number): HogQL {
  const p = new Params();
  const app = appFilter(p, scope, days * 2);
  const install = p.in("event", roles.install);
  const start = since(days);
  return build(
    "overview totals",
    p,
    `SELECT uniqIf(person_id, ${install} AND timestamp >= ${start}) AS new_users,
            uniqIf(person_id, ${install} AND timestamp < ${start}) AS previous_new_users,
            uniqIf(person_id, timestamp >= ${start}) AS active_users,
            uniqIf(person_id, timestamp >= now() - toIntervalDay(7)) AS wau,
            countIf(timestamp >= ${start}) AS total,
            countIf(timestamp < ${start}) AS previous_total
     FROM events
     WHERE ${app} AND ${windowed(days * 2)}`,
  );
}

export function topEventsQuery(scope: AppScope, days: number): HogQL {
  const p = new Params();
  return build(
    "top events",
    p,
    `SELECT event, count() AS total, uniq(person_id) AS users
     FROM events
     WHERE ${appFilter(p, scope, days)} AND ${windowed(days)}
     GROUP BY event ORDER BY total DESC LIMIT 50`,
  );
}

export function funnelSteps(roles: RoleMap) {
  return FUNNEL_ROLES.filter((role) => roles[role].length > 0);
}

export function funnelQuery(scope: AppScope, roles: RoleMap, days: number): HogQL {
  const steps = funnelSteps(roles);
  if (!steps.length) throw new Error("No funnel events are mapped for this app");
  const p = new Params();
  const app = appFilter(p, scope, days);
  const all = [...new Set([...steps.flatMap((role) => roles[role]), ...roles.purchase_start, ...roles.purchase_cancel])];
  const first = p.in("event", roles[steps[0]]);
  const inner = [
    "person_id",
    `minIf(toUnixTimestamp(timestamp), ${first}) AS t0`,
    ...steps.slice(1).map((role, i) => `groupArrayIf(toUnixTimestamp(timestamp), ${p.in("event", roles[role])}) AS a${i + 1}`),
    `countIf(${p.in("event", roles.purchase_start)}) > 0 AS has_start`,
    `minIf(toUnixTimestamp(timestamp), ${p.in("event", roles.purchase_start)}) AS start_at`,
    `maxIf(toUnixTimestamp(timestamp), ${p.in("event", roles.purchase_cancel)}) AS cancel_at`,
  ];
  const middle = [
    "t0",
    "has_start",
    "start_at",
    "cancel_at",
    ...steps.slice(1).flatMap((_, i) => {
      const n = i + 1;
      return [`arrayFilter(x -> t${n - 1} > 0 AND x >= t${n - 1}, a${n}) AS f${n}`, `if(length(f${n}) > 0, arrayMin(f${n}), 0) AS t${n}`];
    }),
  ];
  const outer = [
    "count() AS s0",
    ...steps.slice(1).map((_, i) => `countIf(t${i + 1} > 0) AS s${i + 1}`),
    "countIf(has_start) AS purchase_started",
    "countIf(has_start AND cancel_at >= start_at AND cancel_at > 0) AS purchase_cancelled",
  ];
  return build(
    "funnel",
    p,
    `SELECT ${outer.join(", ")}
     FROM (
       SELECT ${middle.join(", ")}
       FROM (
         SELECT ${inner.join(", ")}
         FROM events
         WHERE ${app} AND ${windowed(days)} AND ${p.in("event", all)}
         GROUP BY person_id
         HAVING countIf(${first}) > 0
       )
     )`,
  );
}

export function retentionQuery(scope: AppScope, roles: RoleMap, days: number, weekly: boolean): HogQL {
  const p = new Params();
  const app = appFilter(p, scope, days);
  const install = p.in("event", roles.install);
  const activity = roles.open.length ? p.in("event", roles.open) : "1 = 1";
  const cohort = weekly ? "toStartOfWeek(d0, 1)" : "d0";
  const retained = (n: number) => `countIf(addDays(d0, ${n}) <= today()) AS e${n}, countIf(has(active, addDays(d0, ${n}))) AS r${n}`;
  return build(
    "retention",
    p,
    `SELECT ${cohort} AS cohort, count() AS users, ${retained(1)}, ${retained(7)}, ${retained(30)}
     FROM (
       SELECT person_id, minIf(toDate(timestamp), ${install}) AS d0, groupUniqArrayIf(toDate(timestamp), ${activity}) AS active
       FROM events
       WHERE ${app} AND ${windowed(days)}
       GROUP BY person_id
       HAVING countIf(${install}) > 0
     )
     GROUP BY cohort ORDER BY cohort DESC LIMIT 400`,
  );
}

export function countriesQuery(scope: AppScope, roles: RoleMap, days: number): HogQL {
  const p = new Params();
  const app = appFilter(p, scope, days);
  return build(
    "countries",
    p,
    `SELECT upper(ifNull(properties.$geoip_country_code, '')) AS country, uniqIf(person_id, ${p.in("event", roles.install)}) AS new_users, uniq(person_id) AS active_users
     FROM events
     WHERE ${app} AND ${windowed(days)}
     GROUP BY country ORDER BY new_users DESC, active_users DESC LIMIT 300`,
  );
}

export function citiesQuery(scope: AppScope, roles: RoleMap, days: number): HogQL {
  const p = new Params();
  const app = appFilter(p, scope, days);
  return build(
    "cities",
    p,
    `SELECT properties.$geoip_city_name AS city, upper(ifNull(properties.$geoip_country_code, '')) AS country,
            uniqIf(person_id, ${p.in("event", roles.install)}) AS new_users, uniq(person_id) AS active_users
     FROM events
     WHERE ${app} AND ${windowed(days)} AND isNotNull(properties.$geoip_city_name) AND properties.$geoip_city_name != ''
     GROUP BY city, country ORDER BY new_users DESC, active_users DESC LIMIT 25`,
  );
}

export function versionsQuery(scope: AppScope, roles: RoleMap, days: number): HogQL {
  const p = new Params();
  const app = appFilter(p, scope, days);
  return build(
    "versions",
    p,
    `SELECT ifNull(properties.$app_version, '') AS version, uniq(person_id) AS users, uniqIf(person_id, ${p.in("event", roles.install)}) AS new_users,
            count() AS total, min(timestamp) AS first_seen, max(timestamp) AS last_seen
     FROM events
     WHERE ${app} AND ${windowed(days)}
     GROUP BY version ORDER BY users DESC LIMIT 60`,
  );
}

export function experimentsQuery(scope: AppScope, roles: RoleMap, days: number): HogQL {
  const p = new Params();
  const exposureApp = appFilter(p, scope, days);
  const conversionApp = appFilter(p, scope, days);
  const paywall = p.in("event", roles.paywall_view);
  const purchase = p.in("event", roles.purchase_success);
  const conversions = p.in("event", [...roles.paywall_view, ...roles.purchase_success]);
  return build(
    "experiments",
    p,
    `SELECT x.flag AS flag, x.variant AS variant, count() AS users,
            countIf(ifNull(c.paywall_at, 0) > 0 AND ifNull(c.paywall_at, 0) >= x.exposed_at) AS paywall_users,
            countIf(ifNull(c.purchase_at, 0) > 0 AND ifNull(c.purchase_at, 0) >= x.exposed_at) AS purchase_users
     FROM (
       SELECT person_id,
              toString(coalesce(properties.$feature_flag, properties.$experiment_key, properties.$experiment_name, '')) AS flag,
              argMin(toString(coalesce(properties.$feature_flag_response, properties.$variant, properties.variant, '')), timestamp) AS variant,
              min(toUnixTimestamp(timestamp)) AS exposed_at
       FROM events
       WHERE ${exposureApp} AND ${windowed(days)} AND ${EXPOSURES}
       GROUP BY person_id, flag
       HAVING flag != ''
     ) AS x
     LEFT JOIN (
       SELECT person_id, maxIf(toUnixTimestamp(timestamp), ${paywall}) AS paywall_at, maxIf(toUnixTimestamp(timestamp), ${purchase}) AS purchase_at
       FROM events
       WHERE ${conversionApp} AND ${windowed(days)} AND ${conversions}
       GROUP BY person_id
     ) AS c ON x.person_id = c.person_id
     GROUP BY flag, variant ORDER BY users DESC LIMIT 500`,
  );
}

export function liveEventsQuery(scope: AppScope, days: number): HogQL {
  const p = new Params();
  return build(
    "live events",
    p,
    `SELECT timestamp, event, distinct_id, properties.$lib AS lib, properties.$geoip_country_code AS country, properties.$app_version AS version
     FROM events
     WHERE ${appFilter(p, scope, days)} AND timestamp >= now() - toIntervalDay(${int(Math.min(days, 7))})
     ORDER BY timestamp DESC LIMIT 100`,
  );
}

export function newUsersQuery(scope: AppScope, roles: RoleMap, days: number, country: string | null): HogQL {
  const p = new Params();
  const app = appFilter(p, scope, days);
  const countryFilter = country ? ` AND upper(ifNull(properties.$geoip_country_code, '')) = ${p.value(country.toUpperCase())}` : "";
  return build(
    "new users",
    p,
    `SELECT toDate(timestamp) AS day, uniq(person_id) AS new_users
     FROM events
     WHERE ${app} AND ${windowed(days)} AND ${p.in("event", roles.install)}${countryFilter}
     GROUP BY day ORDER BY day ASC LIMIT 800`,
  );
}
