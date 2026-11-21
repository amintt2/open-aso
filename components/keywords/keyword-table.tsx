"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { Checkbox } from "@/components/_ui/checkbox";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
} from "@/components/_ui/table";
import type { TrackedKeyword } from "@/lib/client/types";
import type { Sort, SortKey } from "@/lib/keywords/table";
import { cn } from "@/lib/utils";
import KeywordRow, { type RowHandlers } from "./keyword-row";

type Column = {
  key: SortKey | null;
  label: string;
  title?: string;
  align?: "right";
};

const COLUMNS: Column[] = [
  {
    key: "position",
    label: "Position",
    title: "Your rank in App Store search results for this keyword today (top 200), with the change since the previous check",
  },
  {
    key: null,
    label: "30d trend",
    title: "Your position over the last 30 days. Higher on the chart is a better rank.",
  },
  {
    key: "coverage",
    label: "In metadata",
    title: "Where the keyword is in the metadata Apple indexes for this storefront: title, subtitle, keyword field or category. The number is indexing strength, 0–100.",
  },
  {
    key: "relevance",
    label: "Relevance",
    title: "How well the keyword fits your app, 0–100, judged by Jev or estimated from your listing",
  },
  {
    key: "popularity",
    label: "Popularity",
    title: "How often people search this, 5–100. Apple = Apple Search Ads popularity, Est. = modeled from search suggestions.",
  },
  {
    key: "difficulty",
    label: "Difficulty",
    title: "How hard it is to reach the top 10, 1–100, from the strength of the apps ranking today (estimate)",
  },
  {
    key: "label",
    label: "Targeting",
    title: "Summary of popularity versus difficulty: Sweet Spot and Quick Win are the easiest wins",
  },
  {
    key: "downloadsEst",
    label: "Est. DL/mo",
    align: "right",
    title: "Estimated monthly downloads from this keyword at your position",
  },
  {
    key: "top5Downloads",
    label: "Top-5 DL",
    align: "right",
    title: "Estimated monthly downloads of the top 5 apps",
  },
  {
    key: "top5Mrr",
    label: "Top-5 MRR",
    align: "right",
    title: "Estimated monthly revenue of the top 5 apps",
  },
  {
    key: "resultsCount",
    label: "Results",
    align: "right",
    title: "Number of apps returned for this search",
  },
  {
    key: "lastRefreshedAt",
    label: "Updated",
    title: "When this keyword's data was last checked. Orange means older than 20 hours.",
  },
];

const HEAD =
  "sticky top-0 z-20 bg-background shadow-[inset_0_-1px_0_var(--border)]";

function SortHeader({
  column,
  sort,
  onSort,
}: {
  column: Column;
  sort: Sort;
  onSort: (key: SortKey) => void;
}) {
  const active = column.key && sort.key === column.key;
  const Arrow = sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead
      title={column.title}
      aria-sort={
        active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined
      }
      className={cn(HEAD, column.align === "right" && "text-right")}
    >
      {column.key ? (
        <button
          type="button"
          onClick={() => onSort(column.key as SortKey)}
          className={cn(
            "hover:text-soft focus-visible:text-foreground inline-flex cursor-pointer items-center gap-1 outline-none",
            active && "text-foreground",
          )}
        >
          {column.label}
          {active && <Arrow aria-hidden className="size-3" />}
        </button>
      ) : (
        column.label
      )}
    </TableHead>
  );
}

type TableProps = {
  rows: TrackedKeyword[];
  sort: Sort;
  onSort: (key: SortKey) => void;
  selected: ReadonlySet<number>;
  onSelectAll: (checked: boolean) => void;
  refreshing: ReadonlySet<number>;
  sparklines: Record<string, (number | null)[]> | undefined;
  handlers: RowHandlers;
};

export default function KeywordTable({
  rows,
  sort,
  onSort,
  selected,
  onSelectAll,
  refreshing,
  sparklines,
  handlers,
}: TableProps) {
  const selectedVisible = rows.filter((r) => selected.has(r.id)).length;
  const allState =
    selectedVisible === 0
      ? false
      : selectedVisible === rows.length
        ? true
        : "indeterminate";
  const termActive = sort.key === "term";
  const TermArrow = sort.dir === "asc" ? ArrowUp : ArrowDown;

  return (
    <Table className="min-w-[1320px] text-[13px]">
      <TableHeader>
        <TableRow className="border-0">
          <TableHead className={cn(HEAD, "left-0 z-30 w-10 pr-0 pl-4")}>
            <Checkbox
              aria-label="Select all visible keywords"
              checked={allState}
              onCheckedChange={(v) => onSelectAll(v === true)}
            />
          </TableHead>
          <TableHead
            aria-sort={
              termActive
                ? sort.dir === "asc"
                  ? "ascending"
                  : "descending"
                : undefined
            }
            className={cn(HEAD, "border-border left-10 z-30 border-r pl-2")}
          >
            <button
              type="button"
              onClick={() => onSort("term")}
              className={cn(
                "hover:text-soft focus-visible:text-foreground inline-flex cursor-pointer items-center gap-1 pl-[30px] outline-none",
                termActive && "text-foreground",
              )}
            >
              Keyword
              {termActive && <TermArrow aria-hidden className="size-3" />}
            </button>
          </TableHead>
          {COLUMNS.map((c) => (
            <SortHeader key={c.label} column={c} sort={sort} onSort={onSort} />
          ))}
          <TableHead className={cn(HEAD, "w-10")}>
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((k) => (
          <KeywordRow
            key={k.id}
            keyword={k}
            selected={selected.has(k.id)}
            refreshing={refreshing.has(k.id)}
            sparkline={sparklines?.[k.id]}
            handlers={handlers}
          />
        ))}
      </TableBody>
    </Table>
  );
}

export function KeywordTableSkeleton() {
  return (
    <Table className="min-w-[1280px]" aria-busy>
      <TableBody>
        {Array.from({ length: 10 }, (_, i) => (
          <TableRow key={i}>
            <TableCell className="w-10 pr-0 pl-4">
              <span className="bg-muted block size-4 animate-pulse rounded-[4px]" />
            </TableCell>
            <TableCell className="w-[260px]">
              <span
                className="bg-muted block h-3 animate-pulse rounded-full"
                style={{ width: `${45 + ((i * 37) % 45)}%` }}
              />
            </TableCell>
            {Array.from({ length: 10 }, (_, j) => (
              <TableCell key={j}>
                <span
                  className="bg-muted/70 block h-3 w-14 animate-pulse rounded-full"
                  style={{ animationDelay: `${(i + j) * 40}ms` }}
                />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
