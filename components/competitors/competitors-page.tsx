"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Compass, Loader2, MoreHorizontal, Plus, Star, Swords, Trash2 } from "lucide-react";
import { toast } from "sonner";
import Button from "@/components/_ui/button";
import CountBadge from "@/components/_ui/count-badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/_ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import AppIcon from "@/components/shell/app-icon";
import CountrySelect from "@/components/shell/country-select";
import EmptyState from "@/components/shell/empty-state";
import PageHeader from "@/components/shell/page-header";
import SortHead, { compareValues, type SortState } from "@/components/explore/sort-head";
import { useAppCountry, useCurrentApp } from "@/hooks/use-app";
import { COUNTRY_BY_CODE } from "@/lib/appstore/countries";
import { api, revalidate, useApi } from "@/lib/client/api";
import { formatCompact, formatUsd, timeAgo } from "@/lib/client/format";
import type { Competitor } from "@/lib/competitors/types";
import { exploreHref } from "@/lib/explore/format";
import { cn } from "@/lib/utils";
import AddCompetitorDialog from "./add-competitor-dialog";
import RemoveCompetitorDialog from "./remove-competitor-dialog";

type SortKey = "name" | "rating" | "ratingCount" | "downloadsEst" | "revenueEst" | "updatedAt" | "outranksMe";

export default function CompetitorsPage() {
  const { appId, app, error: appError } = useCurrentApp();
  const [country, setCountry] = useAppCountry(app);
  const [addOpen, setAddOpen] = useState(false);
  const [removing, setRemoving] = useState<Competitor | null>(null);
  const [sort, setSort] = useState<SortState<SortKey>>({ key: "downloadsEst", dir: "desc" });
  const key = app ? `/api/apps/${appId}/competitors?country=${country}` : null;
  const { data, error, isLoading } = useApi<Competitor[]>(key);

  const rows = useMemo(() => [...(data ?? [])].sort((a, b) => compareValues(a[sort.key], b[sort.key], sort.dir)), [data, sort]);
  const countryName = COUNTRY_BY_CODE.get(country)?.name ?? country;

  async function remove(c: Pick<Competitor, "id" | "name">) {
    try {
      await api(`/api/competitors/${c.id}`, { method: "DELETE" });
      await revalidate(`/api/apps/${appId}/competitors`);
      toast.success(`${c.name} removed`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove competitor");
    }
  }

  const addButton = (
    <Button variant="primary" size="md" onClick={() => setAddOpen(true)} disabled={!app}>
      <Plus aria-hidden className="size-3.5" />
      Add competitor
    </Button>
  );

  return (
    <>
      <PageHeader
        title="Competitors"
        badge={data && <CountBadge>{data.length}</CountBadge>}
        actions={
          <>
            <CountrySelect value={country} onChange={setCountry} />
            {addButton}
          </>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {appError ? (
          <EmptyState icon={Swords} title="App not found" description="This app is no longer tracked in this workspace." />
        ) : (isLoading || !app) && !error ? (
          <div role="status" className="text-subtle flex items-center justify-center gap-2 py-20">
            <Loader2 aria-hidden className="size-4 animate-spin" /> Loading competitors…
          </div>
        ) : error ? (
          <EmptyState icon={Swords} title="Could not load competitors" description={error instanceof Error ? error.message : undefined} />
        ) : !rows.length ? (
          <EmptyState
            icon={Swords}
            title="No competitors yet"
            description="Track the apps you compete with to compare ratings, estimated downloads and revenue, and see where they outrank you on your keywords."
            action={addButton}
          />
        ) : (
          <div className="flex flex-col gap-3 p-4">
            <p className="caption-style text-subtle">
              Store data for {countryName}. Downloads and revenue are monthly estimates. “Outranks you” counts your tracked keywords where the competitor sits in the top 10 above you.
            </p>
            <div className="border-border overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortHead label="App" sortKey="name" sort={sort} onSort={setSort} initial="asc" className="min-w-[240px]" />
                    <SortHead label="Rating" sortKey="rating" sort={sort} onSort={setSort} />
                    <SortHead label="Ratings" sortKey="ratingCount" sort={sort} onSort={setSort} />
                    <SortHead label="Downloads / mo" sortKey="downloadsEst" sort={sort} onSort={setSort} />
                    <SortHead label="Revenue / mo" sortKey="revenueEst" sort={sort} onSort={setSort} />
                    <SortHead label="Last update" sortKey="updatedAt" sort={sort} onSort={setSort} className="hidden md:table-cell" />
                    <SortHead label="Outranks you" sortKey="outranksMe" sort={sort} onSort={setSort} />
                    <TableHead className="w-12">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((c) => (
                    <TableRow key={c.id} className="hover:bg-white/3">
                      <TableCell className="py-2">
                        <Link href={`/apps/${appId}/competitors/${c.id}`} className="group flex min-w-0 items-center gap-3 outline-none">
                          <AppIcon src={c.iconUrl} name={c.name} className="size-9" />
                          <span className="flex min-w-0 flex-col gap-1.5">
                            <span className="max-w-[260px] truncate group-hover:underline group-focus-visible:underline">{c.name}</span>
                            <span className="caption-style text-subtle max-w-[260px] truncate">{c.developer}</span>
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {c.rating ? (
                          <span className="inline-flex items-center gap-1">
                            <Star aria-hidden className="text-warning size-3 fill-current" />
                            {c.rating.toFixed(2)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="tabular-nums">{formatCompact(c.ratingCount)}</TableCell>
                      <TableCell className="tabular-nums">{formatCompact(c.downloadsEst)}</TableCell>
                      <TableCell className="tabular-nums">{formatUsd(c.revenueEst)}</TableCell>
                      <TableCell className="text-soft hidden md:table-cell">{timeAgo(c.updatedAt)}</TableCell>
                      <TableCell className="tabular-nums">
                        <span className={cn(c.outranksMe > 0 ? "text-danger" : "text-subtle")}>{c.outranksMe}</span>
                        <span className="text-subtle caption-style"> / {c.sharedKeywords}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${c.name}`}>
                              <MoreHorizontal aria-hidden className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/apps/${appId}/competitors/${c.id}`}>
                                <Swords aria-hidden className="size-3.5" /> Compare keywords
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={exploreHref(c.trackId, country)}>
                                <Compass aria-hidden className="size-3.5" /> Open in Explore
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={() => setRemoving(c)} className="text-danger">
                              <Trash2 aria-hidden className="size-3.5" /> Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
      {app && (
        <AddCompetitorDialog open={addOpen} onOpenChange={setAddOpen} appId={appId} appTrackId={app.trackId} country={country} existing={(data ?? []).map((c) => c.trackId)} />
      )}
      <RemoveCompetitorDialog competitor={removing} onOpenChange={(v) => !v && setRemoving(null)} onConfirm={remove} />
    </>
  );
}
