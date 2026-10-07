import { cached } from "@/lib/server/cache";
import { HttpError } from "@/lib/server/http";
import { resolveAscAppId } from "./apps";
import {
  ascDelete,
  ascGetAll,
  ascGetOne,
  ascPatch,
  ascPost,
  ASC_TTL,
  ascCacheKey,
  clearAscCache,
  indexIncluded,
  query,
  relIds,
  type AscResource,
} from "./client";
import { sameLocale } from "./locales";
import {
  INFO_FIELDS,
  METADATA_LIMITS,
  VERSION_FIELDS,
  type AppMetadata,
  type AscAppInfoSummary,
  type AscVersionSummary,
  type InfoField,
  type LocaleMetadata,
  type MetadataPatch,
  type ScreenshotSet,
  type VersionField,
} from "./types";

const EDITABLE_VERSION_STATES = new Set(["PREPARE_FOR_SUBMISSION", "DEVELOPER_REJECTED", "REJECTED", "METADATA_REJECTED", "INVALID_BINARY"]);
const EDITABLE_INFO_STATES = new Set(["PREPARE_FOR_SUBMISSION", "DEVELOPER_REJECTED", "REJECTED", "METADATA_REJECTED"]);
const LIVE_STATES = new Set(["READY_FOR_SALE", "READY_FOR_DISTRIBUTION", "PENDING_APPLE_RELEASE", "PENDING_DEVELOPER_RELEASE", "PROCESSING_FOR_APP_STORE", "PROCESSING_FOR_DISTRIBUTION"]);

type AppInfoAttrs = { state?: string; appStoreState?: string };
type VersionAttrs = { platform?: string; versionString?: string; appStoreState?: string; appVersionState?: string; createdDate?: string };
type AppAttrs = { name?: string; bundleId?: string; primaryLocale?: string };

const key = (ascAppId: string) => `asc:app:${ascAppId}:`;
const cacheKey = (workspaceId: string, ascAppId: string, suffix: string) => ascCacheKey(workspaceId, `${key(ascAppId)}${suffix}`);

function toVersion(r: AscResource<VersionAttrs>): AscVersionSummary {
  const state = r.attributes?.appVersionState ?? r.attributes?.appStoreState ?? "UNKNOWN";
  return {
    id: r.id,
    versionString: r.attributes?.versionString ?? "",
    state,
    platform: r.attributes?.platform ?? "IOS",
    createdDate: r.attributes?.createdDate ?? null,
    editable: EDITABLE_VERSION_STATES.has(state) || EDITABLE_VERSION_STATES.has(r.attributes?.appStoreState ?? ""),
  };
}

function toInfo(r: AscResource<AppInfoAttrs>): AscAppInfoSummary {
  const state = r.attributes?.state ?? r.attributes?.appStoreState ?? "UNKNOWN";
  return { id: r.id, state, editable: EDITABLE_INFO_STATES.has(state) || EDITABLE_VERSION_STATES.has(r.attributes?.appStoreState ?? "") };
}

function pickVersions(all: AscVersionSummary[]) {
  const byDate = [...all].sort((a, b) => (b.createdDate ?? "").localeCompare(a.createdDate ?? ""));
  const platformPool = byDate.some((v) => v.platform === "IOS") ? byDate.filter((v) => v.platform === "IOS") : byDate;
  const editable = platformPool.find((v) => v.editable) ?? null;
  const live = platformPool.find((v) => LIVE_STATES.has(v.state)) ?? null;
  return { editable, live, latest: platformPool[0] ?? null };
}

function emptyLocale(locale: string): LocaleMetadata {
  return {
    locale,
    appInfoLocalizationId: null,
    versionLocalizationId: null,
    name: null,
    subtitle: null,
    privacyPolicyUrl: null,
    privacyChoicesUrl: null,
    keywords: null,
    description: null,
    promotionalText: null,
    whatsNew: null,
    marketingUrl: null,
    supportUrl: null,
  };
}

async function loadMetadata(workspaceId: string, ascAppId: string): Promise<AppMetadata> {
  const [app, infos, versions] = await Promise.all([
    ascGetOne<AppAttrs>(workspaceId, `/v1/apps/${ascAppId}${query({ "fields[apps]": "name,bundleId,primaryLocale" })}`),
    ascGetAll<AppInfoAttrs>(workspaceId, `/v1/apps/${ascAppId}/appInfos${query({ limit: 50 })}`),
    ascGetAll<VersionAttrs>(workspaceId, `/v1/apps/${ascAppId}/appStoreVersions${query({ limit: 50 })}`, 4),
  ]);
  const infoList = infos.data.map(toInfo);
  const appInfo = infoList.find((i) => i.editable) ?? infoList.find((i) => LIVE_STATES.has(i.state)) ?? infoList[0] ?? null;
  const picked = pickVersions(versions.data.map(toVersion));
  const version = picked.editable ?? picked.live ?? picked.latest;

  const [infoLocs, versionLocs] = await Promise.all([
    appInfo ? ascGetAll<Record<InfoField | "locale", string | null>>(workspaceId, `/v1/appInfos/${appInfo.id}/appInfoLocalizations${query({ limit: 200 })}`) : null,
    version
      ? ascGetAll<Record<VersionField | "locale", string | null>>(workspaceId, `/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations${query({ limit: 200 })}`)
      : null,
  ]);

  const locales = new Map<string, LocaleMetadata>();
  const entry = (locale: string) => {
    const found = [...locales.keys()].find((k) => sameLocale(k, locale));
    if (found) return locales.get(found) as LocaleMetadata;
    const created = emptyLocale(locale);
    locales.set(locale, created);
    return created;
  };
  for (const r of infoLocs?.data ?? []) {
    const e = entry(String(r.attributes?.locale ?? ""));
    e.appInfoLocalizationId = r.id;
    for (const f of INFO_FIELDS) e[f] = r.attributes?.[f] ?? null;
  }
  for (const r of versionLocs?.data ?? []) {
    const e = entry(String(r.attributes?.locale ?? ""));
    e.versionLocalizationId = r.id;
    for (const f of VERSION_FIELDS) e[f] = r.attributes?.[f] ?? null;
  }
  const primaryLocale = app.data.attributes?.primaryLocale ?? "en-US";
  const localizations = [...locales.values()]
    .filter((l) => l.locale)
    .sort((a, b) => (sameLocale(a.locale, primaryLocale) ? -1 : sameLocale(b.locale, primaryLocale) ? 1 : a.locale.localeCompare(b.locale)));

  return {
    ascAppId,
    appName: app.data.attributes?.name ?? "",
    bundleId: app.data.attributes?.bundleId ?? "",
    primaryLocale,
    appInfo,
    version,
    liveVersion: picked.live && picked.live.id !== version?.id ? picked.live : null,
    localizations,
    fetchedAt: new Date().toISOString(),
  };
}

export async function getAppMetadata(workspaceId: string, appId: number, opts: { refresh?: boolean } = {}): Promise<AppMetadata> {
  const ascAppId = await resolveAscAppId(workspaceId, appId);
  if (opts.refresh) await clearAscCache(workspaceId, key(ascAppId));
  return cached(cacheKey(workspaceId, ascAppId, "metadata"), ASC_TTL, () => loadMetadata(workspaceId, ascAppId));
}

export async function listLocalizations(workspaceId: string, appId: number) {
  const meta = await getAppMetadata(workspaceId, appId);
  return meta.localizations.map((l) => ({
    locale: l.locale,
    primary: sameLocale(l.locale, meta.primaryLocale),
    hasAppInfo: !!l.appInfoLocalizationId,
    hasVersion: !!l.versionLocalizationId,
    name: l.name,
    subtitle: l.subtitle,
    keywordsLength: l.keywords?.length ?? 0,
  }));
}

export async function getMetadata(workspaceId: string, appId: number, locale?: string) {
  const meta = await getAppMetadata(workspaceId, appId);
  if (!locale) return meta;
  const loc = meta.localizations.find((l) => sameLocale(l.locale, locale));
  if (!loc) throw new HttpError(404, `Locale ${locale} does not exist for this app`);
  return { ...meta, localizations: [loc] };
}

function validatePatch(patch: MetadataPatch) {
  for (const [field, limit] of Object.entries(METADATA_LIMITS)) {
    const value = patch[field as keyof typeof METADATA_LIMITS];
    if (value != null && [...value].length > limit) throw new HttpError(422, `${field} exceeds ${limit} characters`);
  }
}

function pick<F extends string>(patch: MetadataPatch, fields: readonly F[]) {
  const out: Partial<Record<F, string | null>> = {};
  for (const f of fields) {
    const value = (patch as Record<string, string | undefined>)[f];
    if (value !== undefined) out[f] = value === "" ? null : value;
  }
  return out;
}

export async function updateMetadata(workspaceId: string, appId: number, locale: string, patch: MetadataPatch): Promise<LocaleMetadata> {
  validatePatch(patch);
  const meta = await getAppMetadata(workspaceId, appId, { refresh: true });
  const loc = meta.localizations.find((l) => sameLocale(l.locale, locale)) ?? emptyLocale(locale);
  const info = pick(patch, INFO_FIELDS);
  const ver = pick(patch, VERSION_FIELDS);

  if (Object.keys(info).length) {
    if (!meta.appInfo) throw new HttpError(409, "This app has no app info record in App Store Connect");
    if (!meta.appInfo.editable)
      throw new HttpError(409, "Name, subtitle and privacy URLs can only be changed while a new version is being prepared. Create a new version in App Store Connect first.");
    if (loc.appInfoLocalizationId) {
      await ascPatch(workspaceId, `/v1/appInfoLocalizations/${loc.appInfoLocalizationId}`, {
        data: { type: "appInfoLocalizations", id: loc.appInfoLocalizationId, attributes: info },
      });
    } else {
      if (!info.name) throw new HttpError(422, "A name is required to create this localization");
      await ascPost(workspaceId, "/v1/appInfoLocalizations", {
        data: {
          type: "appInfoLocalizations",
          attributes: { locale: loc.locale, ...info },
          relationships: { appInfo: { data: { type: "appInfos", id: meta.appInfo.id } } },
        },
      });
    }
  }

  if (Object.keys(ver).length) {
    if (!meta.version) throw new HttpError(409, "This app has no App Store version. Create a new version in App Store Connect first.");
    const onlyPromo = Object.keys(ver).every((k) => k === "promotionalText");
    if (!meta.version.editable && !onlyPromo)
      throw new HttpError(409, `Version ${meta.version.versionString} is ${meta.version.state.replaceAll("_", " ").toLowerCase()} and can't be edited. Create a new version in App Store Connect first (promotional text can still be changed).`);
    if (loc.versionLocalizationId) {
      await ascPatch(workspaceId, `/v1/appStoreVersionLocalizations/${loc.versionLocalizationId}`, {
        data: { type: "appStoreVersionLocalizations", id: loc.versionLocalizationId, attributes: ver },
      });
    } else {
      await ascPost(workspaceId, "/v1/appStoreVersionLocalizations", {
        data: {
          type: "appStoreVersionLocalizations",
          attributes: { locale: loc.locale, ...ver },
          relationships: { appStoreVersion: { data: { type: "appStoreVersions", id: meta.version.id } } },
        },
      });
    }
  }

  const fresh = await getAppMetadata(workspaceId, appId, { refresh: true });
  return fresh.localizations.find((l) => sameLocale(l.locale, locale)) ?? emptyLocale(locale);
}

export async function addLocalization(workspaceId: string, appId: number, locale: string, init: MetadataPatch = {}) {
  const meta = await getAppMetadata(workspaceId, appId, { refresh: true });
  if (meta.localizations.some((l) => sameLocale(l.locale, locale) && l.appInfoLocalizationId && l.versionLocalizationId))
    throw new HttpError(409, `${locale} already exists`);
  if (!meta.appInfo?.editable && !meta.version?.editable)
    throw new HttpError(409, "Locales can only be added while a new version is being prepared. Create a new version in App Store Connect first.");
  const primary = meta.localizations.find((l) => sameLocale(l.locale, meta.primaryLocale));
  const existing = meta.localizations.find((l) => sameLocale(l.locale, locale));
  const patch: MetadataPatch = { ...init };
  if (meta.appInfo?.editable && !existing?.appInfoLocalizationId) patch.name = init.name || primary?.name || meta.appName;
  if (meta.version?.editable && !existing?.versionLocalizationId && patch.description === undefined) patch.description = init.description ?? "";
  return updateMetadata(workspaceId, appId, locale, patch);
}

export async function deleteLocalization(workspaceId: string, appId: number, locale: string) {
  const meta = await getAppMetadata(workspaceId, appId, { refresh: true });
  if (sameLocale(locale, meta.primaryLocale)) throw new HttpError(409, "The primary locale can't be deleted");
  const loc = meta.localizations.find((l) => sameLocale(l.locale, locale));
  if (!loc) throw new HttpError(404, `Locale ${locale} does not exist`);
  const removed: string[] = [];
  if (loc.versionLocalizationId && meta.version?.editable) {
    await ascDelete(workspaceId, `/v1/appStoreVersionLocalizations/${loc.versionLocalizationId}`);
    removed.push("version");
  }
  if (loc.appInfoLocalizationId && meta.appInfo?.editable) {
    await ascDelete(workspaceId, `/v1/appInfoLocalizations/${loc.appInfoLocalizationId}`);
    removed.push("appInfo");
  }
  if (!removed.length) throw new HttpError(409, "Nothing editable to delete. Create a new version in App Store Connect first.");
  await clearAscCache(workspaceId, key(meta.ascAppId));
  return { removed };
}

type ScreenshotAttrs = { fileName?: string; assetDeliveryState?: { state?: string }; imageAsset?: { templateUrl?: string; width?: number; height?: number } };

function screenshotUrl(a: ScreenshotAttrs | undefined) {
  const asset = a?.imageAsset;
  if (!asset?.templateUrl || !asset.width || !asset.height) return null;
  const width = Math.min(asset.width, 600);
  const height = Math.round((asset.height / asset.width) * width);
  return asset.templateUrl.replace("{w}", String(width)).replace("{h}", String(height)).replace("{f}", "png");
}

export async function getScreenshots(workspaceId: string, appId: number, locale: string, opts: { refresh?: boolean } = {}): Promise<ScreenshotSet[]> {
  const meta = await getAppMetadata(workspaceId, appId, opts);
  const loc = meta.localizations.find((l) => sameLocale(l.locale, locale));
  if (!loc?.versionLocalizationId) return [];
  const id = loc.versionLocalizationId;
  return cached(cacheKey(workspaceId, meta.ascAppId, `screens:${id}`), ASC_TTL, async () => {
    const doc = await ascGetAll<{ screenshotDisplayType?: string }>(
      workspaceId,
      `/v1/appStoreVersionLocalizations/${id}/appScreenshotSets${query({ include: "appScreenshots", limit: 50 })}`,
    );
    const find = indexIncluded(doc.included);
    return doc.data.map((set) => ({
      id: set.id,
      displayType: set.attributes?.screenshotDisplayType ?? "UNKNOWN",
      screenshots: relIds(set, "appScreenshots").map((sid) => {
        const s = find("appScreenshots", sid) as AscResource<ScreenshotAttrs> | undefined;
        return {
          id: sid,
          fileName: s?.attributes?.fileName ?? null,
          url: screenshotUrl(s?.attributes),
          width: s?.attributes?.imageAsset?.width ?? null,
          height: s?.attributes?.imageAsset?.height ?? null,
          state: s?.attributes?.assetDeliveryState?.state ?? null,
        };
      }),
    }));
  });
}
