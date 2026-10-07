import { getSetting, setSetting } from "@/lib/server/settings";
import { HttpError } from "@/lib/server/http";
import { parseJson } from "@/lib/server/db";
import { AppleAdsError, generateKeyPair, getAccessToken, importPrivateKey, readCredentials, resetToken } from "./auth";
import { listOrgs } from "./api";
import { clearAdsCache, getPref, setPref } from "./schema";
import type { AdsConnection, AdsOrg } from "./types";

export function getConnection(): AdsConnection {
  const c = readCredentials();
  const orgId = getSetting("ads.orgId") ?? null;
  const configured = !!(c.clientId && c.teamId && c.keyId && c.privateKey);
  return {
    configured,
    connected: configured && !!orgId,
    clientId: c.clientId ?? null,
    teamId: c.teamId ?? null,
    keyId: c.keyId ?? null,
    orgId,
    orgName: getPref("orgName") ?? null,
    currency: getPref("currency") ?? "USD",
    publicKey: getSetting("ads.publicKey") ?? null,
    hasPrivateKey: !!c.privateKey,
    lastError: getPref("lastError") ?? null,
    lastCheckedAt: getPref("lastCheckedAt") ?? null,
  };
}

export function knownOrgs(): AdsOrg[] {
  return parseJson<AdsOrg[]>(getPref("orgs"), []);
}

export function createKeys(opts: { privateKey?: string; force?: boolean }) {
  if (getSetting("ads.privateKey") && !opts.force && !opts.privateKey)
    throw new HttpError(409, "A key pair already exists. Replacing it will break the connection until the new public key is uploaded to Apple Ads.");
  const result = opts.privateKey ? importPrivateKey(opts.privateKey) : generateKeyPair();
  setPref("lastError", null);
  clearAdsCache();
  return result;
}

function selectOrg(org: AdsOrg | undefined) {
  setSetting("ads.orgId", org?.orgId ?? null);
  setPref("orgName", org?.orgName ?? null);
  setPref("currency", org?.currency ?? null);
}

export function saveConnection(input: { clientId?: string; teamId?: string; keyId?: string; orgId?: string | null }) {
  if (input.clientId !== undefined) setSetting("ads.clientId", input.clientId.trim());
  if (input.teamId !== undefined) setSetting("ads.teamId", input.teamId.trim());
  if (input.keyId !== undefined) setSetting("ads.keyId", input.keyId.trim());
  if (input.orgId !== undefined) {
    const org = knownOrgs().find((o) => o.orgId === input.orgId);
    if (input.orgId && !org) throw new HttpError(400, "Unknown organization. Test the connection first to load your organizations.");
    selectOrg(org);
  }
  resetToken();
  clearAdsCache();
  return getConnection();
}

export async function testConnection(): Promise<{ connection: AdsConnection; orgs: AdsOrg[] }> {
  try {
    await getAccessToken(true);
    const orgs = await listOrgs();
    setPref("orgs", JSON.stringify(orgs));
    const current = getSetting("ads.orgId");
    const chosen = orgs.find((o) => o.orgId === current) ?? (orgs.length === 1 ? orgs[0] : undefined);
    selectOrg(chosen);
    setPref("lastError", null);
    setPref("lastCheckedAt", new Date().toISOString());
    clearAdsCache();
    return { connection: getConnection(), orgs };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setPref("lastError", message);
    setPref("lastCheckedAt", new Date().toISOString());
    if (error instanceof HttpError) throw error;
    throw new HttpError(error instanceof AppleAdsError ? (error.status >= 500 ? 502 : 400) : 502, message);
  }
}

export function disconnect(keepKeys: boolean) {
  for (const key of ["ads.clientId", "ads.teamId", "ads.keyId", "ads.orgId"] as const) setSetting(key, null);
  if (!keepKeys) {
    setSetting("ads.privateKey", null);
    setSetting("ads.publicKey", null);
  }
  for (const key of ["orgName", "currency", "orgs", "lastError", "lastCheckedAt"] as const) setPref(key, null);
  resetToken();
  clearAdsCache();
  return getConnection();
}
