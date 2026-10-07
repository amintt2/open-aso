import { getSetting, setSetting } from "@/lib/server/settings";

export const SHARED_PER_HOUR = 60;

const MEMO_MS = 15_000;

type GlobalWithSharing = typeof globalThis & { __openAsoWorkerSharing?: Map<string, { value: boolean; at: number }> };

function memo() {
  const g = globalThis as GlobalWithSharing;
  g.__openAsoWorkerSharing ??= new Map();
  return g.__openAsoWorkerSharing;
}

export function sharedNetworkEnabled() {
  return process.env.OPEN_ASO_SHARED_WORKERS === "1";
}

export async function workspaceOptedIn(workspaceId: string) {
  const hit = memo().get(workspaceId);
  if (hit && Date.now() - hit.at < MEMO_MS) return hit.value;
  const value = (await getSetting(workspaceId, "worker.shared")) === "true";
  memo().set(workspaceId, { value, at: Date.now() });
  return value;
}

export async function workspaceShares(workspaceId: string) {
  return sharedNetworkEnabled() && (await workspaceOptedIn(workspaceId));
}

export async function setWorkspaceShares(workspaceId: string, on: boolean) {
  await setSetting(workspaceId, "worker.shared", on ? "true" : null);
  memo().delete(workspaceId);
}
