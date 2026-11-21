"use client";

import { type CountrySummary, type Filters } from "@/lib/keywords/table";
import { cn } from "@/lib/utils";

export type QuickFilter = "all" | "ranked" | "topTen" | "inMetadata" | "notInMetadata" | "noise";

const IN_METADATA: NonNullable<Filters["where"]> = ["title", "subtitle", "keywords", "category"];

export function quickOf(f: Filters): QuickFilter | null {
  const where = f.where ?? [];
  const flags = [f.rankedOnly, !!f.topTenOnly, !!f.noiseOnly, where.length > 0].filter(Boolean).length;
  if (flags === 0) return "all";
  if (flags > 1) return null;
  if (f.rankedOnly) return "ranked";
  if (f.topTenOnly) return "topTen";
  if (f.noiseOnly) return "noise";
  if (where.length === 1 && where[0] === "none") return "notInMetadata";
  if (where.length === IN_METADATA.length && IN_METADATA.every((p) => where.includes(p))) return "inMetadata";
  return null;
}

export function applyQuick(f: Filters, quick: QuickFilter): Filters {
  return {
    ...f,
    rankedOnly: quick === "ranked",
    topTenOnly: quick === "topTen",
    noiseOnly: quick === "noise",
    where: quick === "inMetadata" ? IN_METADATA : quick === "notInMetadata" ? ["none"] : [],
  };
}

type Chip = { key: QuickFilter; label: string; value: number; title: string; tone?: string };

export default function KeywordSummary({ summary, scope, filters, onFilters }: { summary: CountrySummary; scope: string; filters: Filters; onFilters: (f: Filters) => void }) {
  const active = quickOf(filters);
  const chips: Chip[] = [
    { key: "all", label: "Tracked", value: summary.total, title: `Every keyword you track in ${scope}` },
    { key: "ranked", label: "Ranked", value: summary.ranked, title: "Your app appears in the top 200 search results for these keywords" },
    { key: "topTen", label: "Top 10", value: summary.topTen, title: "Your app is on the first screen of results (position 1 to 10)" },
    { key: "inMetadata", label: "In metadata", value: summary.inMetadata, title: "Every word is in the title, subtitle, keyword field or category Apple indexes for the storefront" },
    { key: "notInMetadata", label: "Not in metadata", value: summary.total - summary.inMetadata, title: "At least one word is missing from your indexed metadata, so Apple has little reason to rank you" },
    {
      key: "noise",
      label: "Noise",
      value: summary.noise,
      title: "Not in your metadata, not ranked, and unrelated, a competitor brand or in the wrong script. Safe to remove with Clean up. Liked or noted keywords are never counted.",
      tone: summary.noise > 0 ? "text-warning" : undefined,
    },
  ];
  return (
    <div role="group" aria-label={`Keyword summary for ${scope}`} className="border-border flex shrink-0 items-stretch gap-1 overflow-x-auto border-b px-3 py-2">
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          title={c.title}
          aria-pressed={active === c.key}
          onClick={() => onFilters(applyQuick(filters, active === c.key ? "all" : c.key))}
          className={cn(
            "focus-visible:ring-ring/60 flex min-w-[104px] shrink-0 cursor-pointer flex-col items-start gap-1.5 rounded-lg border border-transparent px-3 py-2 text-left transition-colors duration-150 outline-none hover:bg-white/4 focus-visible:ring-2",
            active === c.key && "border-line-strong bg-secondary",
          )}
        >
          <span className="caption-style text-subtle">{c.label}</span>
          <span className={cn("text-[15px] leading-none font-medium tabular-nums", c.tone)}>{c.value.toLocaleString("en-US")}</span>
        </button>
      ))}
    </div>
  );
}
