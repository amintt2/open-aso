"use client";

import { Fragment } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Checkbox } from "@/components/_ui/checkbox";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import type { GroupSort, GroupSortKey, KeywordGroup } from "@/lib/keywords/table";
import { cn } from "@/lib/utils";
import { GroupRow, SubRow, type GroupHandlers } from "./grouped-keyword-row";

type Column = { key: GroupSortKey; label: string; title?: string; align?: "right" };

const COLUMNS: Column[] = [
  { key: "countries", label: "Countries", title: "Storefronts where this keyword is tracked" },
  { key: "position", label: "Best position", title: "Your best rank across countries (top 200)" },
  { key: "popularity", label: "Popularity", title: "Highest popularity across countries, 5–100" },
  { key: "difficulty", label: "Difficulty", title: "Average difficulty across countries, 1–100" },
  { key: "label", label: "Targeting", title: "Most common targeting label" },
  { key: "downloadsEst", label: "Est. DL/mo", align: "right", title: "Estimated monthly downloads from this keyword, summed across countries" },
  { key: "lastRefreshedAt", label: "Updated", title: "Oldest update across countries" },
];

const HEAD = "sticky top-0 z-20 bg-background shadow-[inset_0_-1px_0_var(--border)]";

function SortButton({ column, sort, onSort, className }: { column: Column; sort: GroupSort; onSort: (key: GroupSortKey) => void; className?: string }) {
  const active = sort.key === column.key;
  const Arrow = sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onSort(column.key)}
      className={cn("hover:text-soft focus-visible:text-foreground inline-flex cursor-pointer items-center gap-1 outline-none", active && "text-foreground", className)}
    >
      {column.label}
      {active && <Arrow aria-hidden className="size-3" />}
    </button>
  );
}

function ariaSort(sort: GroupSort, key: GroupSortKey) {
  return sort.key === key ? (sort.dir === "asc" ? "ascending" : "descending") : undefined;
}

type Props = {
  groups: KeywordGroup[];
  expanded: ReadonlySet<string>;
  sort: GroupSort;
  onSort: (key: GroupSortKey) => void;
  selected: ReadonlySet<number>;
  onSelectAll: (checked: boolean) => void;
  refreshing: ReadonlySet<number>;
  handlers: GroupHandlers;
};

export default function GroupedKeywordTable({ groups, expanded, sort, onSort, selected, onSelectAll, refreshing, handlers }: Props) {
  const total = groups.reduce((s, g) => s + g.ids.length, 0);
  const picked = groups.reduce((s, g) => s + g.ids.filter((id) => selected.has(id)).length, 0);
  const allState = picked === 0 ? false : picked === total ? true : "indeterminate";
  const term: Column = { key: "term", label: "Keyword" };

  return (
    <Table className="min-w-[1040px] text-[13px]">
      <TableHeader>
        <TableRow className="border-0">
          <TableHead className={cn(HEAD, "left-0 z-30 w-10 pr-0 pl-4")}>
            <Checkbox aria-label="Select all visible keywords in every country" checked={allState} onCheckedChange={(v) => onSelectAll(v === true)} />
          </TableHead>
          <TableHead aria-sort={ariaSort(sort, "term")} className={cn(HEAD, "border-border left-10 z-30 border-r pl-2")}>
            <SortButton column={term} sort={sort} onSort={onSort} className="pl-[30px]" />
          </TableHead>
          {COLUMNS.map((c) => (
            <TableHead key={c.key} title={c.title} aria-sort={ariaSort(sort, c.key)} className={cn(HEAD, c.align === "right" && "text-right")}>
              <SortButton column={c} sort={sort} onSort={onSort} />
            </TableHead>
          ))}
          <TableHead className={cn(HEAD, "w-10")}>
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map((g) => {
          const open = expanded.has(g.term);
          return (
            <Fragment key={g.term}>
              <GroupRow
                group={g}
                expanded={open}
                selectedCount={g.ids.filter((id) => selected.has(id)).length}
                refreshingCount={g.ids.filter((id) => refreshing.has(id)).length}
                handlers={handlers}
              />
              {open &&
                g.rows.map((k) => <SubRow key={k.id} keyword={k} selected={selected.has(k.id)} refreshing={refreshing.has(k.id)} handlers={handlers} />)}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}
