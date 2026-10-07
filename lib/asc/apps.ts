import { getApp, updateApp } from "@/lib/aso/apps";
import { cached } from "@/lib/server/cache";
import { HttpError } from "@/lib/server/http";
import { ascCacheKey, ascCredentials, ascGet, ascGetAll, ascGetOne, ASC_TTL, AscError, query } from "./client";
import type { AscAppOption } from "./types";

type AppAttrs = { name: string; bundleId: string; sku: string; primaryLocale: string };

const APP_FIELDS = "name,bundleId,sku,primaryLocale";

function toOption(id: string, a: Partial<AppAttrs> | undefined): AscAppOption {
  return { id, name: a?.name ?? id, bundleId: a?.bundleId ?? "", sku: a?.sku ?? "", primaryLocale: a?.primaryLocale ?? "en-US" };
}

async function requireCredentials(workspaceId: string) {
  const creds = await ascCredentials(workspaceId);
  if (!creds) throw new HttpError(412, "App Store Connect is not connected");
  return creds;
}

export async function listAscApps(workspaceId: string): Promise<AscAppOption[]> {
  const creds = await requireCredentials(workspaceId);
  return cached(ascCacheKey(workspaceId, `asc:apps:${creds.keyId}`), ASC_TTL, async () => {
    const doc = await ascGetAll<AppAttrs>(workspaceId, `/v1/apps${query({ limit: 200, "fields[apps]": APP_FIELDS })}`);
    return doc.data.map((d) => toOption(d.id, d.attributes)).sort((a, b) => a.name.localeCompare(b.name));
  });
}

export async function findAscAppByBundleId(workspaceId: string, bundleId: string): Promise<AscAppOption | null> {
  const doc = await ascGet<AppAttrs>(workspaceId, `/v1/apps${query({ "filter[bundleId]": bundleId, "fields[apps]": APP_FIELDS, limit: 5 })}`);
  const exact = doc.data.find((d) => d.attributes?.bundleId === bundleId) ?? doc.data[0];
  return exact ? toOption(exact.id, exact.attributes) : null;
}

async function getAscApp(workspaceId: string, ascAppId: string): Promise<AscAppOption> {
  try {
    const doc = await ascGetOne<AppAttrs>(workspaceId, `/v1/apps/${ascAppId}${query({ "fields[apps]": APP_FIELDS })}`);
    return toOption(doc.data.id, doc.data.attributes);
  } catch (error) {
    if (error instanceof AscError && error.appleStatus === 404) throw new HttpError(404, `App Store Connect app ${ascAppId} is not in this account`);
    throw error;
  }
}

export async function linkAscApp(workspaceId: string, appId: number, ascAppId?: string) {
  const app = await getApp(workspaceId, appId);
  await requireCredentials(workspaceId);
  if (ascAppId) {
    const found = await getAscApp(workspaceId, ascAppId);
    return updateApp(workspaceId, appId, { ascAppId: found.id });
  }
  if (!app.bundleId) throw new HttpError(422, "This app has no bundle ID to match against App Store Connect");
  const found = await findAscAppByBundleId(workspaceId, app.bundleId);
  if (!found) throw new HttpError(404, `No App Store Connect app with bundle ID ${app.bundleId} in this account`);
  return updateApp(workspaceId, appId, { ascAppId: found.id });
}

export function unlinkAscApp(workspaceId: string, appId: number) {
  return updateApp(workspaceId, appId, { ascAppId: null });
}

export async function resolveAscAppId(workspaceId: string, appId: number): Promise<string> {
  const app = await getApp(workspaceId, appId);
  await requireCredentials(workspaceId);
  if (app.ascAppId) return app.ascAppId;
  const linked = await linkAscApp(workspaceId, appId);
  if (!linked.ascAppId) throw new HttpError(409, "This app is not linked to App Store Connect");
  return linked.ascAppId;
}
