"use client";

import { Archive, MoreHorizontal, RefreshCw, Sparkles } from "lucide-react";
import Button from "@/components/_ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/_ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import { COUNTRY_BY_CODE } from "@/lib/appstore/countries";
import type { CountrySummary } from "@/lib/keywords/table";
import { cn } from "@/lib/utils";

const HEAD = "sticky top-0 z-20 bg-background shadow-[inset_0_-1px_0_var(--border)]";

const COLUMNS: { label: string; title: string }[] = [
  { label: "Tracked", title: "Keywords you track in this storefront" },
  { label: "Ranked", title: "Keywords where your app is in the top 200 results" },
  { label: "Top 10", title: "Keywords where your app is in positions 1 to 10" },
  { label: "In metadata", title: "Keywords fully present in the title, subtitle, keyword field or category indexed for this storefront" },
  { label: "Unused", title: "Not in your metadata and not ranked today. Clean up archives the ones unranked for 14 days or more." },
  { label: "Outdated", title: "Keywords whose data is older than 20 hours" },
];

type Props = {
  rows: CountrySummary[];
  onOpen: (country: string) => void;
  onUpdate: (ids: number[]) => void;
  onCleanUp: (country: string) => void;
  onArchiveAll: (ids: number[]) => void;
};

function Share({ value, total, tone }: { value: number; total: number; tone?: string }) {
  return (
    <span className="inline-flex items-center gap-2 tabular-nums">
      <span className={cn("w-9 text-right", value === 0 ? "text-subtle" : tone)}>{value}</span>
      <span aria-hidden className="bg-track h-1.5 w-12 overflow-hidden rounded-full">
        <span className={cn("block h-full rounded-full", tone ? "bg-warning" : "bg-status")} style={{ width: `${total ? Math.round((value / total) * 100) : 0}%` }} />
      </span>
    </span>
  );
}

export default function CountryOverview({ rows, onOpen, onUpdate, onCleanUp, onArchiveAll }: Props) {
  return (
    <Table className="min-w-[860px] text-[13px]">
      <TableHeader>
        <TableRow className="border-0">
          <TableHead className={cn(HEAD, "pl-4")}>Country</TableHead>
          {COLUMNS.map((c) => (
            <TableHead key={c.label} title={c.title} className={HEAD}>
              {c.label}
            </TableHead>
          ))}
          <TableHead className={cn(HEAD, "w-10")}>
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => {
          const meta = COUNTRY_BY_CODE.get(r.country);
          const name = meta?.name ?? r.country.toUpperCase();
          return (
            <TableRow key={r.country} className="bg-background hover:bg-[#1b1b1b]">
              <TableCell className="pl-4">
                <button type="button" onClick={() => onOpen(r.country)} className="inline-flex cursor-pointer items-center gap-2 outline-none hover:underline focus-visible:underline">
                  <span aria-hidden>{meta?.flag}</span>
                  {name}
                </button>
              </TableCell>
              <TableCell className="tabular-nums">{r.total}</TableCell>
              <TableCell>
                <Share value={r.ranked} total={r.total} />
              </TableCell>
              <TableCell>
                <Share value={r.topTen} total={r.total} />
              </TableCell>
              <TableCell>
                <Share value={r.inMetadata} total={r.total} />
              </TableCell>
              <TableCell>
                <Share value={r.noise} total={r.total} tone="text-warning" />
              </TableCell>
              <TableCell className={cn("tabular-nums", r.stale ? "text-soft" : "text-subtle")}>{r.stale}</TableCell>
              <TableCell className="w-10 pr-3 pl-0 text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${name}`}>
                      <MoreHorizontal aria-hidden className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[220px]">
                    <DropdownMenuItem onSelect={() => onUpdate(r.ids)}>
                      <RefreshCw aria-hidden className="size-3.5" /> Update data
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onCleanUp(r.country)} disabled={!r.noise}>
                      <Sparkles aria-hidden className="size-3.5" /> Clean up unused keywords…
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => onArchiveAll(r.ids)} >
                      <Archive aria-hidden className="size-3.5" /> Archive all {r.total} keywords…
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
