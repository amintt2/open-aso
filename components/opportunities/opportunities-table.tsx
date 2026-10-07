"use client";

import { useMemo, useState } from "react";
import { Checkbox } from "@/components/_ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import Tag from "@/components/_ui/tag";
import AppIcon from "@/components/shell/app-icon";
import { LabelTag, PositionBadge, ScoreBar } from "@/components/shell/score";
import SortHead, { compareValues, type SortState } from "@/components/suggestions/sort-head";
import { COUNTRY_BY_CODE } from "@/lib/appstore/countries";
import { formatCompact } from "@/lib/client/format";
import type { CountryOpportunity } from "@/lib/opportunities/types";
import { cn } from "@/lib/utils";

type SortKey = "country" | "popularity" | "difficulty" | "opportunity" | "label" | "position" | "monthlySearches" | "resultsCount";

function sortValue(row: CountryOpportunity, key: SortKey) {
  if (key === "country") return COUNTRY_BY_CODE.get(row.country)?.name ?? row.country;
  return row[key];
}

export default function OpportunitiesTable({
  rows,
  selected,
  onSelectedChange,
  tracked,
  focus,
  onFocus,
}: {
  rows: CountryOpportunity[];
  selected: Set<string>;
  onSelectedChange: (next: Set<string>) => void;
  tracked: Set<string>;
  focus: string | null;
  onFocus: (code: string) => void;
}) {
  const [sort, setSort] = useState<SortState<SortKey>>({ key: "opportunity", dir: "desc" });
  const sorted = useMemo(() => [...rows].sort((a, b) => compareValues(sortValue(a, sort.key), sortValue(b, sort.key), sort.dir)), [rows, sort]);
  const selectable = rows.filter((r) => !r.error && !tracked.has(r.country));
  const allChecked = selectable.length > 0 && selectable.every((r) => selected.has(r.country));
  const someChecked = selectable.some((r) => selected.has(r.country));
  const head = { sort, onSort: setSort };

  function toggle(code: string, on: boolean) {
    const next = new Set(selected);
    if (on) next.add(code);
    else next.delete(code);
    onSelectedChange(next);
  }

  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[1000px]">
        <TableHeader>
          <TableRow>
            <TableHead className="w-10 pr-0">
              <Checkbox
                aria-label="Select all countries"
                disabled={!selectable.length}
                checked={allChecked ? true : someChecked ? "indeterminate" : false}
                onCheckedChange={(v) => onSelectedChange(v === true ? new Set(selectable.map((r) => r.country)) : new Set())}
              />
            </TableHead>
            <SortHead label="Country" sortKey="country" initial="asc" {...head} />
            <SortHead label="Popularity" sortKey="popularity" {...head} />
            <SortHead label="Difficulty" sortKey="difficulty" initial="asc" {...head} />
            <SortHead label="Opportunity" sortKey="opportunity" {...head} />
            <SortHead label="Label" sortKey="label" initial="asc" {...head} />
            <SortHead label="My rank" sortKey="position" initial="asc" {...head} />
            <TableHead>Top app</TableHead>
            <SortHead label="Est. searches/mo" sortKey="monthlySearches" className="text-right" {...head} />
            <SortHead label="Results" sortKey="resultsCount" className="text-right" {...head} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((row) => {
            const c = COUNTRY_BY_CODE.get(row.country);
            const isTracked = tracked.has(row.country);
            const checked = selected.has(row.country);
            return (
              <TableRow
                key={row.country}
                id={`opp-${row.country}`}
                onClick={() => onFocus(row.country)}
                className={cn("cursor-pointer hover:bg-white/3", checked && "bg-white/4", focus === row.country && "bg-white/6")}
              >
                <TableCell className="w-10 pr-0" onClick={(e) => e.stopPropagation()}>
                  <Checkbox aria-label={`Select ${c?.name ?? row.country}`} disabled={isTracked || !!row.error} checked={checked} onCheckedChange={(v) => toggle(row.country, v === true)} />
                </TableCell>
                <TableCell>
                  <span className="flex items-center gap-2">
                    <span aria-hidden>{c?.flag}</span>
                    <span className="max-w-[180px] truncate">{c?.name ?? row.country}</span>
                    {isTracked && (
                      <Tag tone="green" size="sm" className="text-[12px]">
                        Tracked
                      </Tag>
                    )}
                  </span>
                </TableCell>
                {row.error ? (
                  <TableCell colSpan={8} className="text-danger caption-style">
                    {row.error}
                  </TableCell>
                ) : (
                  <>
                    <TableCell>
                      <ScoreBar value={row.popularity} />
                    </TableCell>
                    <TableCell>
                      <ScoreBar value={row.difficulty} invert />
                    </TableCell>
                    <TableCell>
                      <ScoreBar value={row.opportunity} />
                    </TableCell>
                    <TableCell>
                      <LabelTag label={row.label} />
                    </TableCell>
                    <TableCell>
                      <PositionBadge position={row.position} />
                    </TableCell>
                    <TableCell>
                      {row.topApp ? (
                        <span className="flex max-w-[220px] items-center gap-2">
                          <AppIcon src={row.topApp.iconUrl} name={row.topApp.name} className="size-6" />
                          <span className="truncate" title={row.topApp.name}>
                            {row.topApp.name}
                          </span>
                        </span>
                      ) : (
                        <span className="text-subtle">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCompact(row.monthlySearches)}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.resultsCount}</TableCell>
                  </>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
