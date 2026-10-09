import type { HogQL, AppScope } from "@/lib/posthog/hogql";

export function countryPeriodsQuery(
  scope: AppScope,
  install: string[],
  days: number,
): HogQL {
  const values: Record<string, string> = {};
  let index = 0;
  const value = (v: string) => {
    const key = `p${index++}`;
    values[key] = v;
    return `{${key}}`;
  };
  const n = Math.max(1, Math.min(365, Math.round(days)));
  const since = (d: number) => `toStartOfDay(now()) - toIntervalDay(${d - 1})`;
  let app: string;
  if (scope.bundleId)
    app = `properties.$app_namespace = ${value(scope.bundleId)}`;
  else if (scope.prefix) {
    const prefix = value(`${scope.prefix}.`);
    app = `(startsWith(event, ${prefix}) OR ((startsWith(event, '$') OR startsWith(event, 'Application ')) AND distinct_id IN (SELECT distinct_id FROM events WHERE startsWith(event, ${prefix}) AND timestamp >= ${since(2 * n)})))`;
  } else throw new Error("App mapping needs a bundle id or an event prefix");
  const events = [...new Set(install)];
  const inList = events.length
    ? `event IN (${events.map(value).join(", ")})`
    : "0 = 1";
  const query = `SELECT upper(ifNull(properties.$geoip_country_code, '')) AS country,
      uniqIf(person_id, timestamp >= ${since(n)}) AS current,
      uniqIf(person_id, timestamp < ${since(n)}) AS previous
    FROM events
    WHERE ${app} AND timestamp >= ${since(2 * n)} AND ${inList}
    GROUP BY country ORDER BY current DESC, previous DESC LIMIT 300`;
  return {
    name: "open-aso dashboard countries",
    query: query.replace(/\s+/g, " ").trim(),
    values,
  };
}
