"use client";

import { useMemo, useState } from "react";
import { KeyRound, Loader2, Swords } from "lucide-react";
import Button from "@/components/_ui/button";
import Tag from "@/components/_ui/tag";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/_ui/table";
import EmptyState from "@/components/shell/empty-state";
import { PositionBadge, ScoreBar } from "@/components/shell/score";
import SortHead, { compareValues, type SortState } from "@/components/explore/sort-head";
import Stat from "@/components/explore/stat";
import { useApi } from "@/lib/client/api";
import type { Comparison, ComparisonRow } from "@/lib/competitors/types";
import { cn } from "@/lib/utils";

type Filter = "all" | "they" | "me" | "gap";
type SortKey = "term" | "popularity" | "difficulty" | "myPosition" | "theirPosition" | "gap";

const rank = (p: number | null) => p ?? 201;

function status(row: ComparisonRow) {
  if (row.myPosition == null && row.theirPosition == null) return "none" as const;
  if (rank(row.theirPosition) < rank(row.myPosition)) return "they" as const;
  if (rank(row.myPosition) < rank(row.theirPosition)) return "me" as const;
  return "tie" as const;
}

const STATUS = {
  they: { label: "They lead", tone: "red" },
  me: { label: "You lead", tone: "green" },
  tie: { label: "Tied", tone: "neutral" },
  none: { label: "Neither ranks", tone: "neutral" },
} as const;

export default function KeywordComparison({ competitorId, appId, country, name, onTrackKeywords }: { competitorId: number; appId: number; country: string; name: string; onTrackKeywords: () => void }) {
  const { data, error, isLoading } = useApi<Comparison>(`/api/competitors/${competitorId}/comparison?country=${country}`);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortState<SortKey>>({ key: "popularity", dir: "desc" });

  const rows = useMemo(() => {
    const list = (data?.rows ?? []).map((r) => ({ ...r, gap: rank(r.myPosition) - rank(r.theirPosition), status: status(r) }));
    const filtered = list.filter((r) => {
      if (filter === "they") return r.status === "they";
      if (filter === "me") return r.status === "me";
      if (filter === "gap") return r.myPosition == null && r.theirPosition != null;
      return true;
    });
    return filtered.sort((a, b) => compareValues(a[sort.key], b[sort.key], sort.dir));
  }, [data, filter, sort]);

  if (isLoading)
    return (
      <div role="status" className="text-subtle flex items-center justify-center gap-2 py-16">
        <Loader2 aria-hidden className="size-4 animate-spin" /> Comparing rankings…
      </div>
    );
  if (error || !data) return <EmptyState icon={Swords} title="Could not compare keywords" description={error instanceof Error ? error.message : undefined} />;
  if (!data.rows.length)
    return (
      <EmptyState
        icon={KeyRound}
        title="No tracked keywords in this country"
        description={`Track keywords for your app, or import the ones ${name} ranks for.`}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="primary" size="md" onClick={onTrackKeywords}>
              Track their keywords
            </Button>
            <Button variant="secondary" size="md" href={`/apps/${appId}/keywords`}>
              Go to keywords
            </Button>
          </div>
        }
      />
    );

  const filters: { value: Filter; label: string; count: number }[] = [
    { value: "all", label: "All", count: data.rows.length },
    { value: "they", label: "They lead", count: data.theyLead },
    { value: "me", label: "You lead", count: data.iLead },
    { value: "gap", label: "Only they rank", count: data.onlyThey },
  ];

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="They outrank you" value={<span className={cn(data.theyLead > 0 && "text-danger")}>{data.theyLead}</span>} hint={`of ${data.rows.length} keywords`} />
        <Stat label="You outrank them" value={<span className={cn(data.iLead > 0 && "text-trend")}>{data.iLead}</span>} hint={`of ${data.rows.length} keywords`} />
        <Stat label="Both rank" value={data.bothRank} hint="Top 200" />
        <Stat label="Only they rank" value={data.onlyThey} hint="Keyword gaps" />
      </div>
      <div role="group" aria-label="Filter keywords" className="flex flex-wrap gap-1.5">
        {filters.map((f) => (
          <Button key={f.value} variant={filter === f.value ? "muted" : "ghost"} size="sm" aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}>
            {f.label}
            <span className="text-subtle tabular-nums">{f.count}</span>
          </Button>
        ))}
      </div>
      <div className="border-border overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHead label="Keyword" sortKey="term" sort={sort} onSort={setSort} initial="asc" />
              <SortHead label="Popularity" sortKey="popularity" sort={sort} onSort={setSort} />
              <SortHead label="Difficulty" sortKey="difficulty" sort={sort} onSort={setSort} className="hidden md:table-cell" />
              <SortHead label="You" sortKey="myPosition" sort={sort} onSort={setSort} initial="asc" />
              <SortHead label="Them" sortKey="theirPosition" sort={sort} onSort={setSort} initial="asc" />
              <SortHead label="Status" sortKey="gap" sort={sort} onSort={setSort} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.keywordId} className="hover:bg-white/3">
                <TableCell className="max-w-[260px] truncate">{r.term}</TableCell>
                <TableCell>
                  <ScoreBar value={r.popularity} />
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <ScoreBar value={r.difficulty} invert />
                </TableCell>
                <TableCell>
                  <PositionBadge position={r.myPosition} />
                </TableCell>
                <TableCell>
                  <PositionBadge position={r.theirPosition} />
                </TableCell>
                <TableCell>
                  <Tag tone={STATUS[r.status].tone} size="sm" className="text-[12px]">
                    {STATUS[r.status].label}
                  </Tag>
                </TableCell>
              </TableRow>
            ))}
            {!rows.length && (
              <TableRow>
                <TableCell colSpan={6} className="text-subtle py-8 text-center">
                  No keywords match this filter.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <p className="caption-style text-faint">Positions come from your latest keyword analysis (top 10) and live App Store searches (top 200). 200+ means not ranked.</p>
    </div>
  );
}
