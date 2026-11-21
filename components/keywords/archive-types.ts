import { api } from "@/lib/client/api";
import type { TrackedKeyword } from "@/lib/client/types";

export type { ArchiveCandidate, ArchivePreview } from "@/lib/keywords/prune";

export type ArchivableKeyword = TrackedKeyword;

const CHUNK = 5000;

const REASON_LABEL: Record<string, string> = {
  "not-in-metadata": "Not in metadata",
  unranked: "Unranked 14+ days",
  unrelated: "Unrelated",
  brand: "Other brand",
  "wrong-language": "Wrong script",
  manual: "Archived by you",
  auto: "Daily clean-up",
  "clean-up": "Clean up",
};

export function reasonLabel(reason: string) {
  const known = REASON_LABEL[reason];
  if (known) return known;
  const text = reason.replace(/[-_]+/g, " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "Archived";
}

function chunks(ids: number[]) {
  return Array.from({ length: Math.ceil(ids.length / CHUNK) }, (_, i) => ids.slice(i * CHUNK, (i + 1) * CHUNK));
}

export async function archiveIds(appId: number, ids: number[], mode: "candidates" | "exact") {
  let archived = 0;
  for (const part of chunks(ids)) archived += (await api<{ archived: number }>(`/api/apps/${appId}/keywords/archive`, { method: "POST", body: { ids: part, mode } })).archived;
  return archived;
}

export async function restoreIds(appId: number, ids: number[]) {
  let restored = 0;
  for (const part of chunks(ids)) restored += (await api<{ restored: number }>(`/api/apps/${appId}/keywords/restore`, { method: "POST", body: { ids: part } })).restored;
  return restored;
}
