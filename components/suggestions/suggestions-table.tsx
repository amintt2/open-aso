"use client";

import { useMemo, useState } from "react";
import { Checkbox } from "@/components/_ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import Tag from "@/components/_ui/tag";
import { RelevanceCell } from "@/components/shell/relevance";
import { LabelTag, PositionBadge, ScoreBar } from "@/components/shell/score";
import { formatCompact } from "@/lib/client/format";
import { combinedScore, SOURCE_LABEL, type FilteredSuggestion, type Suggestion, type SuggestionSource } from "@/lib/suggestions/types";
import { cn } from "@/lib/utils";
import SortHead, { compareValues, type SortState } from "./sort-head";

type SortKey = "term" | "score" | "relevance" | "popularity" | "difficulty" | "opportunity" | "label" | "position" | "downloadsEst";

type Row = Suggestion & { score: number };

const SOURCE_TONE: Record<SuggestionSource, "blue" | "purple" | "teal" | "amber" | "neutral" | "green"> = {
  hints: "blue",
  "top-apps": "teal",
  metadata: "green",
  competitors: "amber",
  combo: "neutral",
  ai: "purple",
};

function Sources({ sources }: { sources: SuggestionSource[] }) {
  return (
    <span className="flex gap-1">
      {sources.map((s) => (
        <Tag key={s} tone={SOURCE_TONE[s]} size="sm" className="text-[12px]">
          {SOURCE_LABEL[s]}
        </Tag>
      ))}
    </span>
  );
}

function FilteredRow({ row }: { row: FilteredSuggestion }) {
  return (
    <TableRow className="opacity-55 hover:bg-white/3" aria-label={`${row.term}, filtered out`}>
      <TableCell className="w-10 pr-0">
        <Checkbox aria-label={`${row.term} was filtered out`} checked={false} disabled />
      </TableCell>
      <TableCell className="text-soft max-w-[260px] truncate line-through decoration-white/25">{row.term}</TableCell>
      <TableCell>
        <RelevanceCell relevance={row.relevance} category={row.category} source={row.relevanceSource} languageMatch={row.languageMatch} />
      </TableCell>
      <TableCell>
        <Sources sources={row.sources} />
      </TableCell>
      <TableCell colSpan={7} className="caption-style text-subtle">
        {!row.languageMatch ? "Not in a language this storefront searches in" : row.category === "brand" ? "Another app's or company's name" : "Not relevant to this app"}
      </TableCell>
    </TableRow>
  );
}

export default function SuggestionsTable({
  rows,
  filtered = [],
  selected,
  onSelectedChange,
}: {
  rows: Suggestion[];
  filtered?: FilteredSuggestion[];
  selected: Set<string>;
  onSelectedChange: (next: Set<string>) => void;
}) {
  const [sort, setSort] = useState<SortState<SortKey>>({ key: "score", dir: "desc" });
  const sorted = useMemo(
    () =>
      rows
        .map((r): Row => ({ ...r, score: r.score ?? combinedScore(r.relevance, r.opportunity) }))
        .sort((a, b) => compareValues(a[sort.key], b[sort.key], sort.dir) || b.score - a.score),
    [rows, sort],
  );
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.term));
  const someChecked = rows.some((r) => selected.has(r.term));

  function toggle(term: string, on: boolean) {
    const next = new Set(selected);
    if (on) next.add(term);
    else next.delete(term);
    onSelectedChange(next);
  }

  const head = { sort, onSort: setSort };

  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[1180px]">
        <TableHeader>
          <TableRow>
            <TableHead className="w-10 pr-0">
              <Checkbox
                aria-label="Select all suggestions"
                checked={allChecked ? true : someChecked ? "indeterminate" : false}
                onCheckedChange={(v) => onSelectedChange(v === true ? new Set([...selected, ...rows.map((r) => r.term)]) : new Set([...selected].filter((t) => !rows.some((r) => r.term === t))))}
              />
            </TableHead>
            <SortHead label="Keyword" sortKey="term" initial="asc" {...head} />
            <SortHead label="Relevance" sortKey="relevance" {...head} />
            <TableHead>Sources</TableHead>
            <SortHead label="Popularity" sortKey="popularity" {...head} />
            <SortHead label="Difficulty" sortKey="difficulty" initial="asc" {...head} />
            <SortHead label="Label" sortKey="label" initial="asc" {...head} />
            <SortHead label="Opportunity" sortKey="opportunity" {...head} />
            <SortHead label="Score" sortKey="score" {...head} />
            <SortHead label="My rank" sortKey="position" initial="asc" {...head} />
            <SortHead label="Est. downloads/mo" sortKey="downloadsEst" className="text-right" {...head} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((row) => {
            const checked = selected.has(row.term);
            return (
              <TableRow key={row.term} data-state={checked ? "selected" : undefined} className={cn("hover:bg-white/3", checked && "bg-white/4")}>
                <TableCell className="w-10 pr-0">
                  <Checkbox aria-label={`Select ${row.term}`} checked={checked} onCheckedChange={(v) => toggle(row.term, v === true)} />
                </TableCell>
                <TableCell className="max-w-[260px] truncate font-medium">{row.term}</TableCell>
                <TableCell>
                  <RelevanceCell relevance={row.relevance} category={row.category} source={row.relevanceSource} />
                </TableCell>
                <TableCell>
                  <Sources sources={row.sources} />
                </TableCell>
                <TableCell>
                  <ScoreBar value={row.popularity} />
                </TableCell>
                <TableCell>
                  <ScoreBar value={row.difficulty} invert />
                </TableCell>
                <TableCell>
                  <LabelTag label={row.label} />
                </TableCell>
                <TableCell>
                  <ScoreBar value={row.opportunity} />
                </TableCell>
                <TableCell>
                  <ScoreBar value={row.score} />
                </TableCell>
                <TableCell>
                  <PositionBadge position={row.position} />
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatCompact(row.downloadsEst)}</TableCell>
              </TableRow>
            );
          })}
          {filtered.map((row) => (
            <FilteredRow key={`filtered-${row.term}`} row={row} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
