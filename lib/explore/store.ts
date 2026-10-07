import { lookupApp, lookupApps, lookupDeveloperApps, searchApps, type StoreApp } from "@/lib/appstore/itunes";
import { COUNTRIES, getCountry } from "@/lib/appstore/countries";
import { findAppByTrackId } from "@/lib/aso/apps";
import { estimateMonthlyDownloads, estimateMonthlyRevenue } from "@/lib/aso/scoring";
import { cached, cacheGet, cacheSet, DAY, HOUR } from "@/lib/server/cache";
import { HttpError } from "@/lib/server/http";
import { pool } from "./pool";
import { mainTitleTerm, parseAppQuery } from "./text";
import type { ChartEntry, ChartKind, CountryPresence, ExploreAppDetail, SimilarApps } from "./types";

export async function exploreSearch(query: string, country: string): Promise<StoreApp[]> {
  const parsed = parseAppQuery(query);
  if (!parsed) return [];
  const c = getCountry(country).code;
  if ("trackId" in parsed) return lookupApps([parsed.trackId], c);
  return searchApps(parsed.term, c, 60);
}

export async function exploreApp(trackId: number, country: string): Promise<ExploreAppDetail> {
  const c = getCountry(country).code;
  const app = await lookupApp(trackId, c);
  if (!app) throw new HttpError(404, "This app is not available in the selected storefront");
  const downloadsEst = estimateMonthlyDownloads(app, c);
  return {
    app,
    country: c,
    downloadsEst,
    revenueEst: estimateMonthlyRevenue(app, downloadsEst),
    trackedAppId: findAppByTrackId(trackId)?.id ?? null,
  };
}

export function countryPresence(trackId: number): Promise<CountryPresence[]> {
  return cached(`explore:presence:v1:${trackId}`, DAY, () =>
    pool(COUNTRIES, 8, async (country): Promise<CountryPresence> => {
      const app = await lookupApp(trackId, country.code).catch(() => undefined);
      return {
        code: country.code,
        available: !!app,
        rating: app ? Math.round(app.averageUserRating * 100) / 100 : null,
        ratingCount: app ? app.userRatingCount : null,
        price: app ? app.price : null,
        currency: app?.currency ?? null,
        formattedPrice: app?.formattedPrice ?? null,
        version: app?.version ?? null,
      };
    }),
  );
}

export function similarApps(trackId: number, country: string): Promise<SimilarApps> {
  const c = getCountry(country).code;
  return cached(`explore:similar:v1:${c}:${trackId}`, 12 * HOUR, async () => {
    const app = await lookupApp(trackId, c);
    if (!app) throw new HttpError(404, "This app is not available in the selected storefront");
    const term = mainTitleTerm(app.trackName);
    const [byTerm, byGenre, developer] = await Promise.all([
      searchApps(term, c, 50).catch(() => [] as StoreApp[]),
      searchApps(`${term} ${app.primaryGenreName}`, c, 50).catch(() => [] as StoreApp[]),
      app.artistId ? lookupDeveloperApps(app.artistId, c).catch(() => [] as StoreApp[]) : Promise.resolve([] as StoreApp[]),
    ]);
    const seen = new Set<number>([trackId]);
    const developerIds = new Set(developer.map((d) => d.trackId));
    const merged = [...byGenre, ...byTerm].filter((a) => {
      if (seen.has(a.trackId) || developerIds.has(a.trackId)) return false;
      seen.add(a.trackId);
      return true;
    });
    const sameGenre = merged.filter((a) => a.primaryGenreId === app.primaryGenreId);
    const others = merged.filter((a) => a.primaryGenreId !== app.primaryGenreId);
    return {
      similar: [...sameGenre, ...others].slice(0, 18),
      developer: developer.filter((d) => d.trackId !== trackId).sort((a, b) => b.userRatingCount - a.userRatingCount).slice(0, 18),
    };
  });
}

type RssResult = { id: string; name: string; artistName: string; artworkUrl100: string; releaseDate: string; url: string };

type LegacyEntry = {
  id: { label: string; attributes: { "im:id": string } };
  "im:name": { label: string };
  "im:artist": { label: string };
  "im:image": { label: string }[];
  "im:releaseDate"?: { label: string };
};

async function getJson<T>(url: string, timeout: number): Promise<T> {
  const res = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(timeout) });
  if (!res.ok) throw new Error(`Charts feed responded ${res.status}`);
  return (await res.json()) as T;
}

async function marketingFeed(country: string, kind: ChartKind): Promise<ChartEntry[]> {
  const data = await getJson<{ feed?: { results?: RssResult[] } }>(`https://rss.marketingtools.apple.com/api/v2/${country}/apps/top-${kind}/50/apps.json`, 8000);
  return (data.feed?.results ?? []).map((r, i) => ({
    rank: i + 1,
    trackId: Number(r.id),
    name: r.name,
    developer: r.artistName,
    iconUrl: r.artworkUrl100,
    releaseDate: r.releaseDate,
    url: r.url,
  }));
}

async function legacyFeed(country: string, kind: ChartKind): Promise<ChartEntry[]> {
  const data = await getJson<{ feed?: { entry?: LegacyEntry[] } }>(`https://itunes.apple.com/${country}/rss/top${kind}applications/limit=50/json`, 10000);
  return (data.feed?.entry ?? []).map((e, i) => ({
    rank: i + 1,
    trackId: Number(e.id.attributes["im:id"]),
    name: e["im:name"].label,
    developer: e["im:artist"].label,
    iconUrl: e["im:image"][e["im:image"].length - 1]?.label ?? "",
    releaseDate: e["im:releaseDate"]?.label ?? "",
    url: e.id.label,
  }));
}

export function topCharts(country: string, kind: ChartKind): Promise<ChartEntry[]> {
  const c = getCountry(country).code;
  const staleKey = `explore:charts:stale:${c}:${kind}`;
  return cached(`explore:charts:v2:${c}:${kind}`, 3 * HOUR, async () => {
    for (const load of [marketingFeed, legacyFeed]) {
      const entries = await load(c, kind).catch(() => [] as ChartEntry[]);
      if (entries.length) {
        cacheSet(staleKey, entries, 7 * DAY);
        return entries;
      }
    }
    const stale = cacheGet<ChartEntry[]>(staleKey);
    if (stale?.length) return stale;
    throw new HttpError(502, "Apple's top charts feeds are not responding right now");
  });
}
