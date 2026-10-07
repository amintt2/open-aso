"use client";

import { useMemo, useState } from "react";
import { Checkbox } from "@/components/_ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import Tag from "@/components/_ui/tag";
import { LabelTag, PositionBadge, ScoreBar } from "@/components/shell/score";
import { formatCompact } from "@/lib/client/format";
import { SOURCE_LABEL, type Suggestion, type SuggestionSource } from "@/lib/suggestions/types";
import { cn } from "@/lib/utils";
import SortHead, { compareValues, type SortState } from "./sort-head";

type SortKey = "term" | "popularity" | "difficulty" | "opportunity" | "label" | "position" | "downloadsEst";

const SOURCE_TONE: Record<SuggestionSource, "blue" | "purple" | "teal" | "amber" | "neutral" | "green"> = {
  hints: "blue",
  "top-apps": "teal",
  metadata: "green",
  competitors: "amber",
  combo: "neutral",
  ai: "purple",
};

export default function SuggestionsTable({
  rows,
  selected,
  onSelectedChange,
}: {
  rows: Suggestion[];
  selected: Set<string>;
  onSelectedChange: (next: Set<string>) => void;
}) {
  const [sort, setSort] = useState<SortState<SortKey>>({ key: "opportunity", dir: "desc" });
  const sorted = useMemo(
    () => [...rows].sort((a, b) => compareValues(a[sort.key], b[sort.key], sort.dir) || b.opportunity - a.opportunity),
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
      <Table className="min-w-[960px]">
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
            <TableHead>Sources</TableHead>
            <SortHead label="Popularity" sortKey="popularity" {...head} />
            <SortHead label="Difficulty" sortKey="difficulty" initial="asc" {...head} />
            <SortHead label="Label" sortKey="label" initial="asc" {...head} />
            <SortHead label="Opportunity" sortKey="opportunity" {...head} />
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
                  <span className="flex gap-1">
                    {row.sources.map((s) => (
                      <Tag key={s} tone={SOURCE_TONE[s]} size="sm" className="text-[12px]">
                        {SOURCE_LABEL[s]}
                      </Tag>
                    ))}
                  </span>
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
                  <PositionBadge position={row.position} />
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatCompact(row.downloadsEst)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
