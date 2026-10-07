import { cacheGet, cacheSet } from "@/lib/server/cache";
import { HttpError } from "@/lib/server/http";
import { getSetting, setSetting } from "@/lib/server/settings";
import { ascCredentials, clearAscCache, normalizePrivateKey, testAscConnection, type AscCredentials } from "./client";
import type { AscStatus } from "./types";

const statusKey = (keyId: string) => `asc:status:${keyId}`;

export async function getAscStatus(opts: { refresh?: boolean } = {}): Promise<AscStatus> {
  const creds = ascCredentials();
  const base = { issuerId: getSetting("asc.issuerId") ?? null, keyId: getSetting("asc.keyId") ?? null };
  if (!creds) return { configured: false, connected: false, error: null, sampleApp: null, ...base };
  if (!opts.refresh) {
    const hit = cacheGet<AscStatus>(statusKey(creds.keyId));
    if (hit) return hit;
  }
  let status: AscStatus;
  try {
    const result = await testAscConnection(creds);
    status = { configured: true, connected: true, error: null, sampleApp: result.sampleApp, ...base };
  } catch (error) {
    status = { configured: true, connected: false, error: error instanceof Error ? error.message : String(error), sampleApp: null, ...base };
  }
  cacheSet(statusKey(creds.keyId), status, status.connected ? 5 * 60 * 1000 : 30 * 1000);
  return status;
}

export async function saveAscCredentials(input: { issuerId: string; keyId: string; privateKey?: string | null }, opts: { dryRun?: boolean } = {}) {
  const privateKey = input.privateKey?.trim() ? normalizePrivateKey(input.privateKey) : getSetting("asc.privateKey");
  if (!privateKey) throw new HttpError(400, "A private key (.p8) is required");
  const creds: AscCredentials = { issuerId: input.issuerId.trim(), keyId: input.keyId.trim(), privateKey };
  const result = await testAscConnection(creds);
  if (opts.dryRun) return { ok: true, sampleApp: result.sampleApp };
  setSetting("asc.issuerId", creds.issuerId);
  setSetting("asc.keyId", creds.keyId);
  setSetting("asc.privateKey", creds.privateKey);
  clearAscCache("asc:");
  return { ok: true, sampleApp: result.sampleApp };
}

export function clearAscCredentials() {
  setSetting("asc.issuerId", null);
  setSetting("asc.keyId", null);
  setSetting("asc.privateKey", null);
  clearAscCache("asc:");
}
