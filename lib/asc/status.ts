import { cacheGet, cacheSet } from "@/lib/server/cache";
import { HttpError } from "@/lib/server/http";
import { getSetting, setSetting } from "@/lib/server/settings";
import { ascCacheKey, ascCredentials, clearAscCache, forgetAscTokens, normalizePrivateKey, testAscConnection, type AscCredentials } from "./client";
import type { AscStatus } from "./types";

const statusKey = (workspaceId: string, keyId: string) => ascCacheKey(workspaceId, `asc:status:${keyId}`);

export async function getAscStatus(workspaceId: string, opts: { refresh?: boolean } = {}): Promise<AscStatus> {
  const creds = await ascCredentials(workspaceId);
  const base = {
    issuerId: (await getSetting(workspaceId, "asc.issuerId")) ?? null,
    keyId: (await getSetting(workspaceId, "asc.keyId")) ?? null,
  };
  if (!creds) return { configured: false, connected: false, error: null, sampleApp: null, ...base };
  if (!opts.refresh) {
    const hit = await cacheGet<AscStatus>(statusKey(workspaceId, creds.keyId));
    if (hit) return hit;
  }
  let status: AscStatus;
  try {
    const result = await testAscConnection(workspaceId, creds);
    status = { configured: true, connected: true, error: null, sampleApp: result.sampleApp, ...base };
  } catch (error) {
    status = { configured: true, connected: false, error: error instanceof Error ? error.message : String(error), sampleApp: null, ...base };
  }
  await cacheSet(statusKey(workspaceId, creds.keyId), status, status.connected ? 5 * 60 * 1000 : 30 * 1000);
  return status;
}

export async function saveAscCredentials(
  workspaceId: string,
  input: { issuerId: string; keyId: string; privateKey?: string | null },
  opts: { dryRun?: boolean } = {},
) {
  const privateKey = input.privateKey?.trim() ? normalizePrivateKey(input.privateKey) : await getSetting(workspaceId, "asc.privateKey");
  if (!privateKey) throw new HttpError(400, "A private key (.p8) is required");
  const creds: AscCredentials = { issuerId: input.issuerId.trim(), keyId: input.keyId.trim(), privateKey };
  const result = await testAscConnection(workspaceId, creds);
  if (opts.dryRun) return { ok: true, sampleApp: result.sampleApp };
  await setSetting(workspaceId, "asc.issuerId", creds.issuerId);
  await setSetting(workspaceId, "asc.keyId", creds.keyId);
  await setSetting(workspaceId, "asc.privateKey", creds.privateKey);
  forgetAscTokens(workspaceId);
  await clearAscCache(workspaceId);
  return { ok: true, sampleApp: result.sampleApp };
}

export async function clearAscCredentials(workspaceId: string) {
  await setSetting(workspaceId, "asc.issuerId", null);
  await setSetting(workspaceId, "asc.keyId", null);
  await setSetting(workspaceId, "asc.privateKey", null);
  forgetAscTokens(workspaceId);
  await clearAscCache(workspaceId);
}
