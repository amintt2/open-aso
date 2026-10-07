"use client";

import { useMemo, useState } from "react";
import { Globe2, Loader2, RotateCw } from "lucide-react";
import Button from "@/components/_ui/button";
import Tag from "@/components/_ui/tag";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import EmptyState from "@/components/shell/empty-state";
import WorldMap from "@/components/shell/world-map";
import { COUNTRY_BY_CODE } from "@/lib/appstore/countries";
import { useApi } from "@/lib/client/api";
import { formatCompact } from "@/lib/client/format";
import type { CountryPresence as Presence } from "@/lib/explore/types";
import { cn } from "@/lib/utils";
import SortHead, { compareValues, type SortState } from "./sort-head";

type SortKey = "name" | "rating" | "ratingCount" | "price";

export default function CountryPresence({ trackId, country, onSelectCountry }: { trackId: number; country: string; onSelectCountry?: (code: string) => void }) {
  const { data, error, isLoading, mutate } = useApi<Presence[]>(`/api/explore/${trackId}/countries`);
  const [sort, setSort] = useState<SortState<SortKey>>({ key: "ratingCount", dir: "desc" });

  const values = useMemo(
    () => Object.fromEntries((data ?? []).filter((d) => d.available).map((d) => [d.code, Math.log10((d.ratingCount ?? 0) + 1)])),
    [data],
  );
  const rows = useMemo(
    () =>
      (data ?? [])
        .map((d) => ({ ...d, name: COUNTRY_BY_CODE.get(d.code)?.name ?? d.code, flag: COUNTRY_BY_CODE.get(d.code)?.flag ?? "" }))
        .sort((a, b) => Number(b.available) - Number(a.available) || compareValues(a[sort.key], b[sort.key], sort.dir)),
    [data, sort],
  );

  if (isLoading)
    return (
      <div role="status" className="text-subtle flex flex-col items-center gap-3 px-6 py-16 text-center">
        <Loader2 aria-hidden className="size-5 animate-spin" />
        <p>Checking 66 storefronts…</p>
      </div>
    );

  if (error || !data)
    return (
      <EmptyState
        icon={Globe2}
        title="Could not load country presence"
        description={error instanceof Error ? error.message : undefined}
        action={
          <Button variant="secondary" size="md" onClick={() => void mutate()}>
            <RotateCw aria-hidden className="size-3.5" />
            Retry
          </Button>
        }
      />
    );

  const available = data.filter((d) => d.available).length;
  const totalRatings = data.reduce((s, d) => s + (d.ratingCount ?? 0), 0);

  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="caption-style text-subtle">
        Available in {available} of {data.length} storefronts · {formatCompact(totalRatings)} ratings worldwide
      </p>
      <WorldMap
        values={values}
        selected={country}
        onSelect={onSelectCountry}
        format={(v) => `${formatCompact(Math.round(10 ** v - 1))} ratings`}
        legend="Ratings count (log scale)"
        className="mx-auto max-w-[880px]"
      />
      <div className="border-border overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHead label="Country" sortKey="name" sort={sort} onSort={setSort} initial="asc" />
              <TableHead>Status</TableHead>
              <SortHead label="Rating" sortKey="rating" sort={sort} onSort={setSort} />
              <SortHead label="Ratings" sortKey="ratingCount" sort={sort} onSort={setSort} />
              <SortHead label="Price" sortKey="price" sort={sort} onSort={setSort} className="hidden sm:table-cell" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.code} className={cn("hover:bg-white/3", row.code === country && "bg-white/4")}>
                <TableCell>
                  {onSelectCountry && row.available ? (
                    <button type="button" onClick={() => onSelectCountry(row.code)} className="cursor-pointer outline-none hover:underline focus-visible:underline" aria-current={row.code === country ? "true" : undefined}>
                      <span className="mr-2">{row.flag}</span>
                      {row.name}
                    </button>
                  ) : (
                    <>
                      <span className="mr-2">{row.flag}</span>
                      {row.name}
                    </>
                  )}
                </TableCell>
                <TableCell>
                  {row.available ? (
                    <Tag tone="green" size="sm" className="text-[12px]">
                      Available
                    </Tag>
                  ) : (
                    <Tag tone="neutral" size="sm" className="text-[12px]">
                      Not available
                    </Tag>
                  )}
                </TableCell>
                <TableCell className="tabular-nums">{row.rating ? row.rating.toFixed(2) : "—"}</TableCell>
                <TableCell className="tabular-nums">{row.available ? formatCompact(row.ratingCount) : "—"}</TableCell>
                <TableCell className="text-soft hidden sm:table-cell">{row.available ? (row.formattedPrice ?? (row.price ? `${row.price} ${row.currency}` : "Free")) : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
