import { XMLParser } from "fast-xml-parser";
import { appStoreFetch, egressStats } from "./egress";
import { cached, DAY, HOUR } from "@/lib/server/cache";
import { getCountry } from "./countries";

export type StoreApp = {
  trackId: number;
  trackName: string;
  bundleId: string;
  sellerName: string;
  artistId: number;
  artworkUrl100: string;
  artworkUrl512?: string;
  averageUserRating: number;
  userRatingCount: number;
  price: number;
  currency: string;
  formattedPrice?: string;
  primaryGenreName: string;
  primaryGenreId: number;
  genres: string[];
  releaseDate: string;
  currentVersionReleaseDate: string;
  version: string;
  description: string;
  releaseNotes?: string;
  screenshotUrls: string[];
  ipadScreenshotUrls: string[];
  trackViewUrl: string;
  contentAdvisoryRating: string;
  fileSizeBytes?: string;
  minimumOsVersion?: string;
  languageCodesISO2A?: string[];
};

export type Review = {
  id: string;
  author: string;
  title: string;
  content: string;
  rating: number;
  version: string;
  updated: string;
};

async function fetchWithRetry(url: string, init?: { headers?: Record<string, string> }): Promise<Response> {
  return appStoreFetch(url, init);
}

export { egressStats as appStoreThrottleState };

function normalize(raw: Record<string, unknown>): StoreApp {
  const app = raw as unknown as StoreApp;
  return {
    ...app,
    averageUserRating: Number(app.averageUserRating ?? 0),
    userRatingCount: Number(app.userRatingCount ?? 0),
    screenshotUrls: app.screenshotUrls ?? [],
    ipadScreenshotUrls: app.ipadScreenshotUrls ?? [],
    genres: app.genres ?? [],
  };
}

export function searchApps(term: string, country: string, limit = 200): Promise<StoreApp[]> {
  const c = getCountry(country);
  const key = `itunes:search:${c.code}:${limit}:${term.trim().toLowerCase()}`;
  return cached<StoreApp[]>(key, (r) => (r.length ? 6 * HOUR : 5 * 60 * 1000), async () => {
    const url = new URL("https://itunes.apple.com/search");
    url.searchParams.set("term", term.trim());
    url.searchParams.set("country", c.code);
    url.searchParams.set("entity", "software");
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("lang", c.lang);
    const res = await fetchWithRetry(url.toString());
    const data = (await res.json()) as { results: Record<string, unknown>[] };
    return (data.results ?? []).filter((r) => r.kind === "software").map(normalize);
  });
}

export function lookupApps(ids: number[], country: string): Promise<StoreApp[]> {
  const c = getCountry(country);
  const sorted = [...new Set(ids)].sort((a, b) => a - b);
  if (!sorted.length) return Promise.resolve([]);
  const key = `itunes:lookup:${c.code}:${sorted.join(",")}`;
  return cached(key, 12 * HOUR, async () => {
    const out: StoreApp[] = [];
    for (let i = 0; i < sorted.length; i += 150) {
      const url = new URL("https://itunes.apple.com/lookup");
      url.searchParams.set("id", sorted.slice(i, i + 150).join(","));
      url.searchParams.set("country", c.code);
      url.searchParams.set("entity", "software");
      const res = await fetchWithRetry(url.toString());
      const data = (await res.json()) as { results: Record<string, unknown>[] };
      out.push(...(data.results ?? []).filter((r) => r.trackId).map(normalize));
    }
    return out;
  });
}

export async function lookupApp(id: number, country: string): Promise<StoreApp | undefined> {
  return (await lookupApps([id], country))[0];
}

export function lookupDeveloperApps(artistId: number, country: string): Promise<StoreApp[]> {
  const c = getCountry(country);
  return cached(`itunes:artist:${c.code}:${artistId}`, DAY, async () => {
    const url = `https://itunes.apple.com/lookup?id=${artistId}&entity=software&country=${c.code}&limit=200`;
    const res = await fetchWithRetry(url);
    const data = (await res.json()) as { results: Record<string, unknown>[] };
    return (data.results ?? []).filter((r) => r.kind === "software").map(normalize);
  });
}

export function fetchReviews(id: number, country: string, page = 1): Promise<Review[]> {
  const c = getCountry(country);
  return cached(`itunes:reviews:${c.code}:${id}:${page}`, 6 * HOUR, async () => {
    const url = `https://itunes.apple.com/${c.code}/rss/customerreviews/page=${page}/id=${id}/sortby=mostrecent/json`;
    const res = await fetchWithRetry(url);
    if (!res.ok) return [];
    const data = (await res.json().catch(() => ({}))) as {
      feed?: { entry?: Record<string, { label: string } & Record<string, unknown>>[] | Record<string, unknown> };
    };
    const entries = Array.isArray(data.feed?.entry) ? data.feed.entry : [];
    return entries
      .filter((e) => e["im:rating"])
      .map((e) => {
        const get = (k: string) => (e[k] as { label?: string } | undefined)?.label ?? "";
        const author = (e.author as unknown as { name?: { label?: string } })?.name?.label ?? "";
        return {
          id: get("id"),
          author,
          title: get("title"),
          content: get("content"),
          rating: Number(get("im:rating")),
          version: get("im:version"),
          updated: get("updated"),
        };
      });
  });
}

const xml = new XMLParser({ ignoreAttributes: true });

export function searchHints(term: string, country: string): Promise<string[]> {
  const c = getCountry(country);
  const key = `itunes:hints:${c.code}:${term.toLowerCase()}`;
  return cached(key, 3 * DAY, async () => {
    const url = `https://search.itunes.apple.com/WebObjects/MZSearchHints.woa/wa/hints?clientApplication=Software&term=${encodeURIComponent(term)}`;
    const res = await fetchWithRetry(url, {
      headers: { "X-Apple-Store-Front": `${c.storefront}-1,29` },
    });
    const text = await res.text();
    const parsed = xml.parse(text) as {
      plist?: { dict?: { array?: { dict?: { string?: string | string[] }[] | { string?: string | string[] } } } };
    };
    const arr = parsed.plist?.dict?.array?.dict;
    const dicts = Array.isArray(arr) ? arr : arr ? [arr] : [];
    return dicts
      .map((d) => (Array.isArray(d.string) ? d.string[0] : d.string))
      .filter((s): s is string => typeof s === "string")
      .map((s) => s.toLowerCase());
  });
}

export function artwork(url: string | undefined, size = 128) {
  if (!url) return "";
  return url.replace(/\/\d+x\d+(bb)?\.(png|jpg|webp)$/, `/${size}x${size}bb.png`);
}
