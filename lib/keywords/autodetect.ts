import { getCountry } from "@/lib/appstore/countries";
import { getApp, updateApp } from "@/lib/aso/apps";
import { lookupApp } from "@/lib/appstore/itunes";
import { HttpError } from "@/lib/server/http";
import { addKeywords, listKeywords, refreshKeywords } from "@/lib/aso/keywords";
import { normalizeTerm } from "@/lib/aso/scoring";
import { discoverRankingKeywords } from "@/lib/explore/ranking-keywords";
import { cacheGet, cacheSet, DAY, wsKey } from "@/lib/server/cache";
import { findRunningJob, startJob, type JobState } from "@/lib/suggestions/jobs";

export type DetectSource = "asc-keywords" | "asc-metadata" | "ranking";

export type DetectedKeyword = { term: string; source: DetectSource; position: number | null; popularity: number | null };

export type DetectResult = {
  appId: number;
  country: string;
  added: DetectedKeyword[];
  skipped: number;
  usedAppStoreConnect: boolean;
  appStoreConnect: AscUse;
  appStoreConnectMessage: string | null;
  finishedAt: string;
};

const MAX_ADD = 40;
const KIND = "keyword-detect";

function key(appId: number, country: string) {
  return `${appId}:${country}`;
}

function splitKeywordField(value: string | null | undefined) {
  return (value ?? "")
    .split(/[,،、，]/)
    .map(normalizeTerm)
    .filter((t) => t.length > 1);
}

function phrases(value: string | null | undefined) {
  const words = normalizeTerm(value ?? "")
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
  const out: string[] = [];
  for (let n = 1; n <= 3; n++) for (let i = 0; i + n <= words.length; i++) out.push(words.slice(i, i + n).join(" "));
  return out;
}

export type AscUse = "used" | "not-connected" | "not-linked" | "error";

async function ascCandidates(
  workspaceId: string,
  appId: number,
  country: string,
): Promise<{ terms: DetectedKeyword[]; status: AscUse; message: string | null; subtitle: string | null }> {
  const { isAscConfigured } = await import("@/lib/asc/client");
  if (!(await isAscConfigured(workspaceId))) return { terms: [], status: "not-connected", message: null, subtitle: null };
  try {
    const app = await getApp(workspaceId, appId);
    if (!app.ascAppId) {
      const { resolveAscAppId } = await import("@/lib/asc/apps");
      await resolveAscAppId(workspaceId, appId).catch(() => null);
      if (!(await getApp(workspaceId, appId)).ascAppId) return { terms: [], status: "not-linked", message: null, subtitle: null };
    }
    const { getAppMetadata } = await import("@/lib/asc/metadata");
    const meta = await getAppMetadata(workspaceId, appId);
    const indexed = getCountry(country).indexedLocales;
    let picks = meta.localizations.filter((l) => indexed.includes(l.locale));
    if (!picks.length) picks = meta.localizations.filter((l) => l.locale === meta.primaryLocale);
    const fromField = picks.flatMap((l) => splitKeywordField(l.keywords)).map((term) => ({ term, source: "asc-keywords" as const, position: null, popularity: null }));
    const fromMeta = picks
      .flatMap((l) => [...phrases(l.name), ...phrases(l.subtitle)])
      .map((term) => ({ term, source: "asc-metadata" as const, position: null, popularity: null }));
    const subtitle = picks.find((l) => l.subtitle)?.subtitle ?? null;
    return { terms: [...fromField, ...fromMeta], status: "used", message: null, subtitle };
  } catch (error) {
    return { terms: [], status: "error", message: error instanceof Error ? error.message : String(error), subtitle: null };
  }
}

export async function lastDetection(workspaceId: string, appId: number, country: string) {
  return (await cacheGet<DetectResult>(wsKey(workspaceId, `keywords:detect:last:${key(appId, country)}`))) ?? null;
}

export function runningDetection(workspaceId: string, appId: number, country: string) {
  return findRunningJob<DetectResult>(KIND, `${workspaceId}:${key(appId, country)}`) ?? null;
}

type Progress = { setStage: (stage: string, total?: number) => void; tick: (n?: number) => void; addTotal: (n: number) => void };

async function detectCountry(workspaceId: string, appId: number, c: string, job: Progress, label = "", deferred?: number[]): Promise<DetectResult> {
  const app = await getApp(workspaceId, appId);
  job.setStage(`${label}Reading your App Store metadata`);
  const asc = await ascCandidates(workspaceId, appId, c);
  if (asc.subtitle && !app.subtitle) await updateApp(workspaceId, appId, { subtitle: asc.subtitle.slice(0, 30) });
  job.tick();

  job.setStage(`${label}Finding keywords your app already ranks for`);
  const ranking = await discoverRankingKeywords(app.trackId, c, asc.subtitle ?? app.subtitle, { popularity: false }).catch(() => []);
  job.tick();

  const tracked = new Set((await listKeywords(workspaceId, appId, c)).map((k) => k.term));
  const rankingByTerm = new Map(ranking.map((r) => [normalizeTerm(r.term), r]));
  const picked = new Map<string, DetectedKeyword>();
  const consider = (k: DetectedKeyword) => {
    const term = normalizeTerm(k.term);
    if (!term || term.length > 100 || tracked.has(term) || picked.has(term)) return;
    const rank = rankingByTerm.get(term);
    picked.set(term, { ...k, term, position: rank?.position ?? k.position, popularity: rank?.popularity ?? k.popularity });
  };
  asc.terms.filter((t) => t.source === "asc-keywords").forEach(consider);
  ranking
    .filter((r) => (r.source === "title" || r.source === "subtitle" ? r.position <= 150 : r.position <= 50))
    .forEach((r) => consider({ term: r.term, source: "ranking", position: r.position, popularity: r.popularity }));
  asc.terms.filter((t) => t.source === "asc-metadata" && rankingByTerm.has(t.term)).forEach(consider);

  const selected = [...picked.values()].slice(0, MAX_ADD);
  const skipped = picked.size - selected.length;
  job.tick();

  if (selected.length) {
    const added = await addKeywords(workspaceId, appId, selected.map((s) => s.term), c);
    const ids = added.filter((k) => !k.lastRefreshedAt).map((k) => k.id);
    if (deferred) deferred.push(...ids);
    else job.addTotal(ids.length);
    if (!deferred) job.setStage(`${label}Scoring detected keywords`);
    for (let i = 0; !deferred && i < ids.length; i += 4) {
      await refreshKeywords(workspaceId, ids.slice(i, i + 4), 4);
      job.tick(Math.min(4, ids.length - i));
    }
  }

  const result: DetectResult = {
    appId,
    country: c,
    added: selected,
    skipped,
    usedAppStoreConnect: asc.status === "used",
    appStoreConnect: asc.status,
    appStoreConnectMessage: asc.message,
    finishedAt: new Date().toISOString(),
  };
  await cacheSet(wsKey(workspaceId, `keywords:detect:last:${key(appId, c)}`), result, 30 * DAY);
  return result;
}

export function startDetection(workspaceId: string, appId: number, country: string): JobState<DetectResult> {
  const c = getCountry(country).code;
  return startJob<DetectResult>(KIND, `${workspaceId}:${key(appId, c)}`, async (job) => {
    job.setStage("Starting", 3);
    return detectCountry(workspaceId, appId, c, job);
  });
}

export type MultiDetectResult = DetectResult & {
  countries: { country: string; added: number; skipped: number; error: string | null }[];
  totalAdded: number;
  stoppedReason: string | null;
};

export function runningMultiDetection(workspaceId: string, appId: number) {
  return findRunningJob<MultiDetectResult>(KIND, `${workspaceId}:${appId}:multi`) ?? null;
}

export async function lastMultiDetection(workspaceId: string, appId: number) {
  return (await cacheGet<MultiDetectResult>(wsKey(workspaceId, `keywords:detect:last:${appId}:multi`))) ?? null;
}

export function startMultiDetection(workspaceId: string, appId: number, countries: string[]): JobState<MultiDetectResult> {
  const list = [...new Set(countries.map((c) => getCountry(c).code))];
  return startJob<MultiDetectResult>(KIND, `${workspaceId}:${appId}:multi`, async (job) => {
    job.setStage("Starting", list.length * 3);
    const app = await getApp(workspaceId, appId);
    const summary: MultiDetectResult["countries"] = [];
    const all: DetectedKeyword[] = [];
    const toScore: number[] = [];
    let last: DetectResult | null = null;
    let stoppedReason: string | null = null;
    for (const [i, c] of list.entries()) {
      const label = `${c.toUpperCase()} (${i + 1}/${list.length}) · `;
      const available = await lookupApp(app.trackId, c).catch(() => undefined);
      if (!available) {
        summary.push({ country: c, added: 0, skipped: 0, error: "Not available in this storefront" });
        job.tick(3);
        continue;
      }
      try {
        last = await detectCountry(workspaceId, appId, c, job, label, toScore);
        summary.push({ country: c, added: last.added.length, skipped: last.skipped, error: null });
        all.push(...last.added);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        summary.push({ country: c, added: 0, skipped: 0, error: message });
        if (error instanceof HttpError && error.status === 402) {
          stoppedReason = message;
          break;
        }
      }
    }
    const result: MultiDetectResult = {
      appId,
      country: "multi",
      added: all,
      skipped: summary.reduce((s, c) => s + c.skipped, 0),
      usedAppStoreConnect: last?.usedAppStoreConnect ?? false,
      appStoreConnect: last?.appStoreConnect ?? "not-connected",
      appStoreConnectMessage: last?.appStoreConnectMessage ?? null,
      finishedAt: new Date().toISOString(),
      countries: summary,
      totalAdded: all.length,
      stoppedReason,
    };
    await cacheSet(wsKey(workspaceId, `keywords:detect:last:${appId}:multi`), result, 30 * DAY);
    if (toScore.length) void refreshKeywords(workspaceId, toScore, 3).catch(() => undefined);
    return result;
  });
}
