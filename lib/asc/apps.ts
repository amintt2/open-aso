import { getApp, updateApp } from "@/lib/aso/apps";
import { cached } from "@/lib/server/cache";
import { HttpError } from "@/lib/server/http";
import { ascGetAll, ascGet, ASC_TTL, ascCredentials, query } from "./client";
import type { AscAppOption } from "./types";

type AppAttrs = { name: string; bundleId: string; sku: string; primaryLocale: string };

function toOption(id: string, a: Partial<AppAttrs> | undefined): AscAppOption {
  return { id, name: a?.name ?? id, bundleId: a?.bundleId ?? "", sku: a?.sku ?? "", primaryLocale: a?.primaryLocale ?? "en-US" };
}

export function listAscApps(): Promise<AscAppOption[]> {
  const creds = ascCredentials();
  return cached(`asc:apps:${creds?.keyId ?? "none"}`, ASC_TTL, async () => {
    const doc = await ascGetAll<AppAttrs>(`/v1/apps${query({ limit: 200, "fields[apps]": "name,bundleId,sku,primaryLocale" })}`);
    return doc.data.map((d) => toOption(d.id, d.attributes)).sort((a, b) => a.name.localeCompare(b.name));
  });
}

export async function findAscAppByBundleId(bundleId: string): Promise<AscAppOption | null> {
  const doc = await ascGet<AppAttrs>(`/v1/apps${query({ "filter[bundleId]": bundleId, "fields[apps]": "name,bundleId,sku,primaryLocale", limit: 5 })}`);
  const exact = doc.data.find((d) => d.attributes?.bundleId === bundleId) ?? doc.data[0];
  return exact ? toOption(exact.id, exact.attributes) : null;
}

export async function linkAscApp(appId: number, ascAppId?: string) {
  const app = getApp(appId);
  if (ascAppId) return updateApp(appId, { ascAppId });
  if (!app.bundleId) throw new HttpError(422, "This app has no bundle ID to match against App Store Connect");
  const found = await findAscAppByBundleId(app.bundleId);
  if (!found) throw new HttpError(404, `No App Store Connect app with bundle ID ${app.bundleId} in this account`);
  return updateApp(appId, { ascAppId: found.id });
}

export function unlinkAscApp(appId: number) {
  return updateApp(appId, { ascAppId: null });
}

export async function resolveAscAppId(appId: number): Promise<string> {
  if (!ascCredentials()) throw new HttpError(412, "App Store Connect is not connected");
  const app = getApp(appId);
  if (app.ascAppId) return app.ascAppId;
  const linked = await linkAscApp(appId);
  if (!linked.ascAppId) throw new HttpError(409, "This app is not linked to App Store Connect");
  return linked.ascAppId;
}
