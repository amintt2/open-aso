import Tag from "@/components/_ui/tag";
import { RELEVANCE_LABEL, RELEVANCE_TONE, type RelevanceCategory, type RelevanceSource } from "@/lib/relevance/types";
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
}: {
  relevance: number | null | undefined;
  category: RelevanceCategory | null | undefined;
  source?: RelevanceSource | null;
  languageMatch?: boolean;
}) {
  if (relevance == null || !category) return <span className="text-subtle">—</span>;
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
    </span>
  );
}
