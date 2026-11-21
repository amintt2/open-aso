import type { TrackedKeyword } from "@/lib/client/types";

export type ArchivableKeyword = TrackedKeyword & { archivedAt?: string | null; archiveReason?: string | null };

export type ArchiveCandidate = { id: number; term: string; country: string; popularity: number | null; relevance: number | null; reasons: string[] };

export type ArchivePreview = { candidates: ArchiveCandidate[]; byCountry: Record<string, number>; scanned: number };

const REASON_LABEL: Record<string, string> = {
  "not-in-metadata": "Not in metadata",
  unranked: "Unranked 14+ days",
  unrelated: "Unrelated",
  brand: "Other brand",
  "wrong-language": "Wrong script",
  manual: "Archived by you",
  auto: "Archived automatically",
};

export function reasonLabel(reason: string) {
  const known = REASON_LABEL[reason];
  if (known) return known;
  const text = reason.replace(/[-_]+/g, " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "Archived";
}

export function reasonList(reason: string | null | undefined) {
  return (reason ?? "")
    .split(/[,;|]+/)
    .map((r) => r.trim())
    .filter(Boolean)
    .map(reasonLabel);
}
