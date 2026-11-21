import Tag from "@/components/_ui/tag";
import { RELEVANCE_LABEL, RELEVANCE_TONE, type RelevanceCategory, type RelevanceSource } from "@/lib/relevance/types";
import type { KeywordCoverage } from "@/lib/keywords/coverage";
import { cn } from "@/lib/utils";
import { ScoreBar } from "./score";

export function RelevanceSourceBadge({ source, className }: { source: RelevanceSource | "mixed"; className?: string }) {
  const jev = source !== "heuristic";
  return (
    <span
      title={
        source === "jev"
          ? "Relevance judged by TypeSafe's Jev model"
          : source === "mixed"
            ? "Mostly judged by Jev; some keywords fell back to the keyword-overlap heuristic"
            : "Relevance estimated from word overlap with your listing. Configure TypeSafe to judge it with Jev."
      }
      className={cn(
        "caption-style inline-flex h-[20px] items-center rounded-full border px-1.5",
        jev ? "border-(--tag-purple-border) bg-(--tag-purple-bg) text-(--tag-purple-text)" : "border-border text-subtle",
        className,
      )}
    >
      {source === "jev" ? "Judged by Jev" : source === "mixed" ? "Jev + heuristic" : "Heuristic"}
    </span>
  );
}

export function RelevanceCell({
  relevance,
  category,
  source,
  languageMatch = true,
  coverage,
}: {
  relevance: number | null | undefined;
  category: RelevanceCategory | null | undefined;
  source?: RelevanceSource | null;
  languageMatch?: boolean;
  coverage?: KeywordCoverage;
}) {
  if (relevance == null || !category) return <span className="text-subtle">—</span>;
  const covered = coverage && (coverage.match === "exact" || coverage.match === "words");
  const how = source === "jev" ? "Judged by Jev" : "Heuristic estimate";
  return (
    <span className="inline-flex items-center gap-1.5" title={`${RELEVANCE_LABEL[category]} · ${Math.round(relevance)}/100 · ${how}`}>
      <ScoreBar value={relevance} />
      <Tag tone={RELEVANCE_TONE[category]} size="sm" className="text-[12px]">
        {RELEVANCE_LABEL[category]}
      </Tag>
      {!languageMatch && (
        <Tag tone="red" size="sm" className="text-[12px]" title="Written in a script this storefront's shoppers rarely search in">
          Language
        </Tag>
      )}
      {coverage && <CoverageTag coverage={coverage} covered={!!covered} />}
    </span>
  );
}

const FIELD_LABEL = { title: "Title", subtitle: "Subtitle", keywords: "Keywords", category: "Category" } as const;

function CoverageTag({ coverage, covered }: { coverage: KeywordCoverage; covered: boolean }) {
  if (!covered)
    return (
      <span className="caption-style text-faint" title={coverage.missing.length ? `Not in your indexed metadata: ${coverage.missing.join(", ")}` : "Not in your indexed metadata for this storefront"}>
        Not in metadata
      </span>
    );
  const field = coverage.field ? FIELD_LABEL[coverage.field] : "Metadata";
  return (
    <span
      className="caption-style text-soft"
      title={`${coverage.match === "exact" ? "Exact phrase" : "All words"} in your ${field.toLowerCase()} (${coverage.locale}${coverage.primaryLocale ? "" : ", secondary locale"}) · indexing strength ${coverage.score}/100`}
    >
      {field}
      {coverage.primaryLocale ? "" : ` · ${coverage.locale}`}
    </span>
  );
}
