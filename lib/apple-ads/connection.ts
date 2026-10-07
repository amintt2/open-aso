import { getSetting, getSettings, setSetting } from "@/lib/server/settings";
import { HttpError } from "@/lib/server/http";
import { parseJson } from "@/lib/server/db";
import { AppleAdsError, generateKeyPair, getAccessToken, importPrivateKey, resetToken } from "./auth";
import { listOrgs } from "./api";
import { clearAdsCache, getPref, getPrefs, setPref } from "./prefs";
import type { AdsConnection, AdsOrg } from "./types";

export async function getConnection(workspaceId: string): Promise<AdsConnection> {
  const [s, prefs] = await Promise.all([
    getSettings(workspaceId, ["ads.clientId", "ads.teamId", "ads.keyId", "ads.privateKey", "ads.publicKey", "ads.orgId"]),
    getPrefs(workspaceId),
  ]);
  const configured = !!(s["ads.clientId"] && s["ads.teamId"] && s["ads.keyId"] && s["ads.privateKey"]);
  const orgId = s["ads.orgId"] ?? null;
  return {
    configured,
    connected: configured && !!orgId,
    clientId: s["ads.clientId"] ?? null,
    teamId: s["ads.teamId"] ?? null,
    keyId: s["ads.keyId"] ?? null,
    orgId,
    orgName: prefs.orgName ?? null,
    currency: prefs.currency ?? "USD",
    publicKey: s["ads.publicKey"] ?? null,
    hasPrivateKey: !!s["ads.privateKey"],
    lastError: prefs.lastError ?? null,
    lastCheckedAt: prefs.lastCheckedAt ?? null,
  };
}

export async function knownOrgs(workspaceId: string): Promise<AdsOrg[]> {
  return parseJson<AdsOrg[]>(await getPref(workspaceId, "orgs"), []);
}

export async function createKeys(workspaceId: string, opts: { privateKey?: string; force?: boolean }) {
  if ((await getSetting(workspaceId, "ads.privateKey")) && !opts.force && !opts.privateKey)
    throw new HttpError(409, "A key pair already exists. Replacing it will break the connection until the new public key is uploaded to Apple Ads.");
  const result = opts.privateKey ? await importPrivateKey(workspaceId, opts.privateKey) : await generateKeyPair(workspaceId);
  await setPref(workspaceId, "lastError", null);
  await clearAdsCache(workspaceId);
  return result;
}

async function selectOrg(workspaceId: string, org: AdsOrg | undefined) {
  await setSetting(workspaceId, "ads.orgId", org?.orgId ?? null);
  await setPref(workspaceId, "orgName", org?.orgName ?? null);
  await setPref(workspaceId, "currency", org?.currency ?? null);
}

export async function saveConnection(workspaceId: string, input: { clientId?: string; teamId?: string; keyId?: string; orgId?: string | null }) {
  if (input.clientId !== undefined) await setSetting(workspaceId, "ads.clientId", input.clientId.trim());
  if (input.teamId !== undefined) await setSetting(workspaceId, "ads.teamId", input.teamId.trim());
  if (input.keyId !== undefined) await setSetting(workspaceId, "ads.keyId", input.keyId.trim());
  if (input.orgId !== undefined) {
    const org = (await knownOrgs(workspaceId)).find((o) => o.orgId === input.orgId);
    if (input.orgId && !org) throw new HttpError(400, "Unknown organization. Test the connection first to load your organizations.");
    await selectOrg(workspaceId, org);
  }
  resetToken(workspaceId);
  await clearAdsCache(workspaceId);
  return getConnection(workspaceId);
}

export async function testConnection(workspaceId: string): Promise<{ connection: AdsConnection; orgs: AdsOrg[] }> {
  try {
    await getAccessToken(workspaceId, true);
    const orgs = await listOrgs(workspaceId);
    await setPref(workspaceId, "orgs", JSON.stringify(orgs));
    const current = await getSetting(workspaceId, "ads.orgId");
    const chosen = orgs.find((o) => o.orgId === current) ?? (orgs.length === 1 ? orgs[0] : undefined);
    await selectOrg(workspaceId, chosen);
    await setPref(workspaceId, "lastError", null);
    await setPref(workspaceId, "lastCheckedAt", new Date().toISOString());
    await clearAdsCache(workspaceId);
    return { connection: await getConnection(workspaceId), orgs };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await setPref(workspaceId, "lastError", message);
    await setPref(workspaceId, "lastCheckedAt", new Date().toISOString());
    if (error instanceof HttpError) throw error;
    throw new HttpError(error instanceof AppleAdsError ? (error.status >= 500 ? 502 : 400) : 502, message);
  }
}

export async function disconnect(workspaceId: string, keepKeys: boolean) {
  for (const key of ["ads.clientId", "ads.teamId", "ads.keyId", "ads.orgId"] as const) await setSetting(workspaceId, key, null);
  if (!keepKeys) {
    await setSetting(workspaceId, "ads.privateKey", null);
    await setSetting(workspaceId, "ads.publicKey", null);
  }
  for (const key of ["orgName", "currency", "orgs", "lastError", "lastCheckedAt"] as const) await setPref(workspaceId, key, null);
  resetToken(workspaceId);
  await clearAdsCache(workspaceId);
  return getConnection(workspaceId);
}
