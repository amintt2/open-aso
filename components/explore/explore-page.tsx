"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid, List, Loader2, Search, SearchX, TrendingUp, X } from "lucide-react";
import Button from "@/components/_ui/button";
import { Input } from "@/components/_ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/_ui/tabs";
import CountrySelect from "@/components/shell/country-select";
import EmptyState from "@/components/shell/empty-state";
import PageHeader from "@/components/shell/page-header";
import { COUNTRY_BY_CODE } from "@/lib/appstore/countries";
import { useApi } from "@/lib/client/api";
import type { StoreApp } from "@/lib/client/types";
import { exploreHref } from "@/lib/explore/format";
import { parseAppQuery } from "@/lib/explore/text";
import type { ChartEntry, ChartKind } from "@/lib/explore/types";
import { cn } from "@/lib/utils";
import { AppCard, StoreAppGrid } from "./app-card";

type Layout = "grid" | "list";

function LayoutToggle({ value, onChange }: { value: Layout; onChange: (v: Layout) => void }) {
  return (
    <div role="group" aria-label="Layout" className="bg-secondary flex items-center gap-0.5 rounded-full p-0.5 shadow-[0px_0px_0px_1px_rgba(0,0,0,0.4)]">
      {(["grid", "list"] as const).map((v) => {
        const Icon = v === "grid" ? LayoutGrid : List;
        return (
          <Button key={v} variant="ghost" size="icon-sm" aria-pressed={value === v} aria-label={v === "grid" ? "Grid view" : "List view"} onClick={() => onChange(v)} className={cn(value === v && "bg-muted text-foreground")}>
            <Icon aria-hidden className="size-3.5" />
          </Button>
        );
      })}
    </div>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div role="status" className="text-subtle flex items-center justify-center gap-2 py-16">
      <Loader2 aria-hidden className="size-4 animate-spin" /> {label}
    </div>
  );
}

function Results({ query, country, layout }: { query: string; country: string; layout: Layout }) {
  const { data, error, isLoading } = useApi<StoreApp[]>(`/api/explore/search?q=${encodeURIComponent(query)}&country=${country}`);
  if (isLoading) return <Loading label="Searching the App Store…" />;
  if (error) return <EmptyState icon={SearchX} title="Search failed" description={error instanceof Error ? error.message : undefined} />;
  if (!data?.length) return <EmptyState icon={SearchX} title="No apps found" description={`Nothing matched “${query}” in ${COUNTRY_BY_CODE.get(country)?.name ?? country}.`} />;
  return (
    <div className="flex flex-col gap-3">
      <p className="caption-style text-subtle">
        {data.length} results for “{query}”
      </p>
      <StoreAppGrid apps={data} country={country} layout={layout} />
    </div>
  );
}

function Chart({ kind, country, layout }: { kind: ChartKind; country: string; layout: Layout }) {
  const { data, error, isLoading } = useApi<ChartEntry[]>(`/api/explore/charts?country=${country}&kind=${kind}`);
  if (isLoading) return <Loading label="Loading top charts…" />;
  if (error || !data?.length) return <EmptyState icon={TrendingUp} title="Top charts unavailable" description={error instanceof Error ? error.message : "Apple's charts feed returned no apps for this storefront."} />;
  return (
    <ul className={cn(layout === "grid" ? "grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3" : "divide-border flex flex-col divide-y")}>
      {data.map((entry) => (
        <li key={entry.trackId} className="min-w-0">
          <AppCard href={exploreHref(entry.trackId, country)} iconUrl={entry.iconUrl} name={entry.name} subtitle={entry.developer} rank={entry.rank} layout={layout} />
        </li>
      ))}
    </ul>
  );
}

export default function ExplorePage({ initialQuery, initialCountry }: { initialQuery: string; initialCountry: string }) {
  const router = useRouter();
  const [country, setCountry] = useState(initialCountry);
  const [input, setInput] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  const [layout, setLayout] = useState<Layout>("grid");
  const [chart, setChart] = useState<ChartKind>("free");

  function sync(q: string, c: string) {
    const params = new URLSearchParams({ country: c });
    if (q) params.set("q", q);
    router.replace(`/explore?${params.toString()}`, { scroll: false });
  }

  function submit() {
    const value = input.trim();
    const parsed = parseAppQuery(value);
    if (parsed && "trackId" in parsed) {
      router.push(exploreHref(parsed.trackId, country));
      return;
    }
    setQuery(value);
    sync(value, country);
  }

  function changeCountry(code: string) {
    setCountry(code);
    sync(query, code);
  }

  function clear() {
    setInput("");
    setQuery("");
    sync("", country);
  }

  return (
    <>
      <PageHeader title="Explore" actions={<CountrySelect value={country} onChange={changeCountry} />} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 p-4 md:py-8">
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="flex flex-col gap-3"
          >
            <label htmlFor="explore-search" className="h2-style">
              Research any app on the App Store
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search aria-hidden className="text-subtle absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
                <Input
                  id="explore-search"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="App name, developer, App ID or apps.apple.com link"
                  className="h-11 rounded-xl pr-10 pl-10 text-[14px]"
                  autoComplete="off"
                />
                {input && (
                  <Button variant="ghost" size="icon-sm" aria-label="Clear search" onClick={clear} className="absolute top-1/2 right-2.5 -translate-y-1/2">
                    <X aria-hidden className="size-3.5" />
                  </Button>
                )}
              </div>
              <Button type="submit" variant="primary" size="md" className="h-11 px-5" disabled={!input.trim()}>
                Search
              </Button>
            </div>
          </form>

          {query ? (
            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <h2>Search results</h2>
                <LayoutToggle value={layout} onChange={setLayout} />
              </div>
              <Results query={query} country={country} layout={layout} />
            </section>
          ) : (
            <section className="flex flex-col gap-1">
              <Tabs value={chart} onValueChange={(v) => setChart(v as ChartKind)}>
                <div className="border-border flex items-center justify-between gap-2 border-b">
                  <div className="flex items-center gap-4">
                    <h2 className="hidden sm:block">Top charts</h2>
                    <TabsList>
                      <TabsTrigger value="free">Top free</TabsTrigger>
                      <TabsTrigger value="paid">Top paid</TabsTrigger>
                    </TabsList>
                  </div>
                  <LayoutToggle value={layout} onChange={setLayout} />
                </div>
                <TabsContent value="free" className="pt-4">
                  <Chart kind="free" country={country} layout={layout} />
                </TabsContent>
                <TabsContent value="paid" className="pt-4">
                  <Chart kind="paid" country={country} layout={layout} />
                </TabsContent>
              </Tabs>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
