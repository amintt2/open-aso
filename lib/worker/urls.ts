export type TaskKind = "search" | "lookup" | "reviews";

export const MAX_BODY_BYTES = 2_000_000;

const SEARCH = /^https:\/\/itunes\.apple\.com\/search\?[A-Za-z0-9%._~*+=&,-]{1,600}$/;
const LOOKUP = /^https:\/\/itunes\.apple\.com\/lookup\?[A-Za-z0-9%._~*+=&,-]{1,2600}$/;
const REVIEWS = /^https:\/\/itunes\.apple\.com\/[a-z]{2}\/rss\/customerreviews\/page=\d{1,2}\/id=\d{1,12}\/sortby=mostrecent\/json$/;

export function taskKind(url: string): TaskKind | null {
  if (SEARCH.test(url)) return "search";
  if (LOOKUP.test(url)) return "lookup";
  if (REVIEWS.test(url)) return "reviews";
  return null;
}

export function isWorkerUrl(url: string) {
  return taskKind(url) !== null;
}

const HTTPS_FIELDS = ["artworkUrl60", "artworkUrl100", "artworkUrl512", "trackViewUrl", "artistViewUrl"];
const HTTPS_LISTS = ["screenshotUrls", "ipadScreenshotUrls", "appletvScreenshotUrls"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isHttps(value: unknown) {
  return typeof value === "string" && value.startsWith("https://");
}

function validStoreResult(r: unknown): boolean {
  if (!isRecord(r)) return false;
  if ("trackId" in r && !(typeof r.trackId === "number" && Number.isSafeInteger(r.trackId) && r.trackId > 0)) return false;
  if ("artistId" in r && !(typeof r.artistId === "number" && Number.isSafeInteger(r.artistId))) return false;
  if (r.kind === "software" || r.wrapperType === "software") {
    if (typeof r.trackId !== "number" || typeof r.trackName !== "string") return false;
  }
  for (const f of HTTPS_FIELDS) if (r[f] !== undefined && !isHttps(r[f])) return false;
  for (const f of HTTPS_LISTS) if (r[f] !== undefined && !(Array.isArray(r[f]) && (r[f] as unknown[]).every(isHttps))) return false;
  if (r.sellerUrl !== undefined && !(typeof r.sellerUrl === "string" && /^https?:\/\//.test(r.sellerUrl))) return false;
  for (const f of ["averageUserRating", "userRatingCount", "price"]) if (r[f] !== undefined && typeof r[f] !== "number") return false;
  return true;
}

function validReviewEntry(e: unknown): boolean {
  if (!isRecord(e)) return false;
  for (const [k, v] of Object.entries(e)) {
    if (k === "author" || k === "link" || k === "im:contentType" || k === "im:voteSum" || k === "im:voteCount") continue;
    if (isRecord(v) && "label" in v && typeof v.label !== "string") return false;
  }
  return true;
}

export function validateBody(url: string, body: string): string | null {
  const kind = taskKind(url);
  if (!kind) return "URL not allowed";
  if (body.length > MAX_BODY_BYTES) return "Response too large";
  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    return "Response is not JSON";
  }
  if (!isRecord(data)) return "Unexpected response shape";
  if (kind === "reviews") {
    if (!isRecord(data.feed)) return "Unexpected review feed shape";
    const entry = data.feed.entry;
    if (entry === undefined) return null;
    const entries = Array.isArray(entry) ? entry : [entry];
    if (entries.length > 100 || !entries.every(validReviewEntry)) return "Unexpected review entries";
    return null;
  }
  if (!Array.isArray(data.results)) return "Missing results";
  if (data.results.length > 400) return "Too many results";
  if (data.resultCount !== undefined && typeof data.resultCount !== "number") return "Unexpected result count";
  if (!data.results.every(validStoreResult)) return "Unexpected result shape";
  return null;
}
