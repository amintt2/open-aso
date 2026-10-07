"use client";

import { useMemo, useState } from "react";
import { Check, KeyRound, Loader2, Plus, RotateCw } from "lucide-react";
import { toast } from "sonner";
import Button from "@/components/_ui/button";
import { Checkbox } from "@/components/_ui/checkbox";
import Tag from "@/components/_ui/tag";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import EmptyState from "@/components/shell/empty-state";
import { PositionBadge, ScoreBar } from "@/components/shell/score";
import { useApi } from "@/lib/client/api";
import type { TrackedApp, TrackedKeyword } from "@/lib/client/types";
import type { KeywordSource, RankingKeyword } from "@/lib/explore/types";
import SortHead, { compareValues, type SortState } from "./sort-head";
import TargetAppMenu from "./target-app-menu";
import { trackKeywords } from "./track-keywords";

type SortKey = "term" | "position" | "popularity" | "resultsCount";

const SOURCE_LABEL: Record<KeywordSource, { label: string; tone: "blue" | "purple" | "neutral" | "teal" | "amber" }> = {
  title: { label: "Title", tone: "blue" },
  subtitle: { label: "Subtitle", tone: "purple" },
  description: { label: "Description", tone: "neutral" },
  hint: { label: "Search hint", tone: "teal" },
  genre: { label: "Category", tone: "amber" },
};

type Props = {
  trackId: number;
  country: string;
  targetAppId?: number;
  targetAppName?: string;
  excludeTrackIds?: number[];
};

export default function RankingKeywordsTable({ trackId, country, targetAppId, targetAppName = "your app", excludeTrackIds = [] }: Props) {
  const { data, error, isLoading, mutate } = useApi<RankingKeyword[]>(`/api/explore/${trackId}/keywords?country=${country}`);
  const { data: tracked, mutate: mutateTracked } = useApi<TrackedKeyword[]>(targetAppId ? `/api/apps/${targetAppId}/keywords?country=${country}` : null);
  const [sort, setSort] = useState<SortState<SortKey>>({ key: "position", dir: "asc" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  const trackedTerms = useMemo(() => new Set(tracked?.map((k) => k.term)), [tracked]);
  const rows = useMemo(
    () => [...(data ?? [])].sort((a, b) => compareValues(a[sort.key], b[sort.key], sort.dir) || a.position - b.position),
    [data, sort],
  );
  const selectable = rows.filter((r) => !trackedTerms.has(r.term));
  const allSelected = selectable.length > 0 && selectable.every((r) => selected.has(r.term));

  async function track(appId: number, appName: string, terms: string[], key: string) {
    if (!terms.length) return;
    setBusy(key);
    try {
      const count = await trackKeywords(appId, terms, country);
      toast.success(`${count} keyword${count === 1 ? "" : "s"} tracked in ${appName} — analyzing now`);
      setSelected(new Set());
      void mutateTracked();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not track keywords");
    } finally {
      setBusy(null);
    }
  }

  function toggle(term: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(term);
      else next.delete(term);
      return next;
    });
  }

  function trackControl(terms: string[], keyName: string, label: string, size: "sm" | "icon-sm") {
    const icon = busy === keyName ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : <Plus aria-hidden className="size-3.5" />;
    const button = (onClick?: () => void) => (
      <Button variant={size === "sm" ? "primary" : "ghost"} size={size} disabled={busy !== null || !terms.length} aria-label={size === "icon-sm" ? label : undefined} onClick={onClick}>
        {icon}
        {size === "sm" && label}
      </Button>
    );
    if (targetAppId) return button(() => void track(targetAppId, targetAppName, terms, keyName));
    return (
      <TargetAppMenu label="Track in…" exclude={excludeTrackIds} onSelect={(app: TrackedApp) => void track(app.id, app.name, terms, keyName)}>
        {button()}
      </TargetAppMenu>
    );
  }

  if (isLoading)
    return (
      <div role="status" className="text-subtle flex flex-col items-center gap-3 px-6 py-16 text-center">
        <Loader2 aria-hidden className="size-5 animate-spin" />
        <p>Discovering ranking keywords…</p>
        <p className="caption-style text-faint max-w-[380px]">We test up to 40 candidate searches built from the title, description and search hints. The first run can take up to a minute.</p>
      </div>
    );

  if (error)
    return (
      <EmptyState
        icon={KeyRound}
        title="Could not discover keywords"
        description={error instanceof Error ? error.message : "Unexpected error"}
        action={
          <Button variant="secondary" size="md" onClick={() => void mutate()}>
            <RotateCw aria-hidden className="size-3.5" />
            Retry
          </Button>
        }
      />
    );

  if (!rows.length)
    return <EmptyState icon={KeyRound} title="No ranking keywords found" description="This app does not rank in the top 200 for any of the candidate searches in this storefront." />;

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <p className="caption-style text-subtle">
          {rows.length} keywords where this app ranks in the top 200 · popularity is an estimate
        </p>
        {trackControl([...selected], "bulk", selected.size ? `Track ${selected.size} selected` : "Track selected", "sm")}
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  aria-label="Select all keywords"
                  checked={allSelected ? true : selected.size ? "indeterminate" : false}
                  onCheckedChange={(v) => setSelected(v === true ? new Set(selectable.map((r) => r.term)) : new Set())}
                />
              </TableHead>
              <SortHead label="Keyword" sortKey="term" sort={sort} onSort={setSort} initial="asc" />
              <SortHead label="Position" sortKey="position" sort={sort} onSort={setSort} initial="asc" />
              <SortHead label="Popularity" sortKey="popularity" sort={sort} onSort={setSort} />
              <SortHead label="Results" sortKey="resultsCount" sort={sort} onSort={setSort} className="hidden md:table-cell" />
              <TableHead className="hidden sm:table-cell">Found in</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Track</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const isTracked = trackedTerms.has(row.term);
              const source = SOURCE_LABEL[row.source];
              return (
                <TableRow key={row.term} className="hover:bg-white/3">
                  <TableCell>
                    <Checkbox aria-label={`Select ${row.term}`} disabled={isTracked} checked={selected.has(row.term)} onCheckedChange={(v) => toggle(row.term, v === true)} />
                  </TableCell>
                  <TableCell className="max-w-[280px] truncate">{row.term}</TableCell>
                  <TableCell>
                    <PositionBadge position={row.position} />
                  </TableCell>
                  <TableCell>
                    <ScoreBar value={row.popularity} />
                  </TableCell>
                  <TableCell className="text-soft hidden tabular-nums md:table-cell">{row.resultsCount}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Tag tone={source.tone} size="sm" className="text-[12px]">
                      {source.label}
                    </Tag>
                  </TableCell>
                  <TableCell className="text-right">
                    {isTracked ? (
                      <span className="text-trend inline-flex size-6 items-center justify-center" title="Already tracked">
                        <Check aria-label="Already tracked" className="size-3.5" />
                      </span>
                    ) : (
                      trackControl([row.term], row.term, `Track ${row.term}`, "icon-sm")
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
