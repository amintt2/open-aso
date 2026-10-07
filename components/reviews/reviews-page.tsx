"use client";

import { useMemo, useState } from "react";
import { Loader2, MessageSquareText, RotateCw, Search, Sparkles, X } from "lucide-react";
import Button from "@/components/_ui/button";
import CountBadge from "@/components/_ui/count-badge";
import { Input } from "@/components/_ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/_ui/select";
import EmptyState from "@/components/shell/empty-state";
import PageHeader from "@/components/shell/page-header";
import Stat from "@/components/explore/stat";
import { useAppCountry, useCurrentApp } from "@/hooks/use-app";
import { useApi } from "@/lib/client/api";
import { formatCompact } from "@/lib/client/format";
import type { ExploreAppDetail } from "@/lib/explore/types";
import type { ReviewsResponse } from "@/lib/reviews/types";
import { MAJOR_COUNTRIES } from "@/lib/reviews/types";
import { cn } from "@/lib/utils";
import AiSummary from "./ai-summary";
import RatingDistribution from "./rating-distribution";
import ReviewCard from "./review-card";
import ScopeSelect from "./scope-select";
import ThemesPanel from "./themes-panel";

type SortKey = "newest" | "oldest" | "highest" | "lowest" | "longest";

const SORTS: { value: SortKey; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "highest", label: "Highest rating" },
  { value: "lowest", label: "Lowest rating" },
  { value: "longest", label: "Most detailed" },
];

const PAGE = 30;

function Panel({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("bg-card border-border flex flex-col gap-3 rounded-lg border p-4", className)}>
      <h2 className="h3-style">{title}</h2>
      {children}
    </section>
  );
}

function average(list: { rating: number }[]) {
  return list.length ? list.reduce((s, r) => s + r.rating, 0) / list.length : null;
}

export default function ReviewsPage() {
  const { app } = useCurrentApp();
  const [country, setCountry] = useAppCountry(app);
  const [allCountries, setAllCountries] = useState(false);
  const scope = allCountries ? "all" : country;
  const [stars, setStars] = useState<number[]>([]);
  const [version, setVersion] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [limit, setLimit] = useState(PAGE);

  const { data, error, isLoading, mutate } = useApi<ReviewsResponse>(app ? `/api/reviews/${app.trackId}?country=${scope}` : null);
  const { data: store } = useApi<ExploreAppDetail>(app && scope !== "all" ? `/api/explore/${app.trackId}?country=${scope}` : null);
  const { data: settings } = useApi<Record<string, unknown>>("/api/settings");
  const aiReady = !!settings?.["ai.anthropicKey"];

  const reviews = useMemo(() => data?.reviews ?? [], [data]);
  const versions = useMemo(() => [...new Set(reviews.map((r) => r.version).filter(Boolean))].sort((a, b) => b.localeCompare(a, undefined, { numeric: true })), [reviews]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = reviews.filter(
      (r) =>
        (!stars.length || stars.includes(r.rating)) &&
        (version === "all" || r.version === version) &&
        (!q || `${r.title} ${r.content} ${r.author}`.toLowerCase().includes(q)),
    );
    const time = (s: string) => new Date(s).getTime();
    const sorters: Record<SortKey, (a: (typeof list)[number], b: (typeof list)[number]) => number> = {
      newest: (a, b) => time(b.updated) - time(a.updated),
      oldest: (a, b) => time(a.updated) - time(b.updated),
      highest: (a, b) => b.rating - a.rating || time(b.updated) - time(a.updated),
      lowest: (a, b) => a.rating - b.rating || time(b.updated) - time(a.updated),
      longest: (a, b) => b.content.length - a.content.length,
    };
    return [...list].sort(sorters[sort]);
  }, [reviews, stars, version, query, sort]);

  const recentAvg = average(reviews);
  const monthAgo = new Date(data?.fetchedAt ?? 0).getTime() - 30 * 86400000;
  const last30 = reviews.filter((r) => new Date(r.updated).getTime() >= monthAgo);
  const last30Avg = average(last30);
  const filtersActive = stars.length > 0 || version !== "all" || query.trim() !== "";

  function changeScope(value: string) {
    setLimit(PAGE);
    setVersion("all");
    if (value === "all") {
      setAllCountries(true);
      return;
    }
    setAllCountries(false);
    setCountry(value);
  }

  function toggleStar(star: number) {
    setLimit(PAGE);
    setStars((prev) => (prev.includes(star) ? prev.filter((s) => s !== star) : [...prev, star]));
  }

  function resetFilters() {
    setStars([]);
    setVersion("all");
    setQuery("");
    setLimit(PAGE);
  }

  return (
    <>
      <PageHeader title="Reviews" badge={data && <CountBadge>{reviews.length}</CountBadge>} actions={<ScopeSelect value={scope} onChange={changeScope} />} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {!app || isLoading ? (
          <div role="status" className="text-subtle flex flex-col items-center justify-center gap-2 py-20 text-center">
            <Loader2 aria-hidden className="size-4 animate-spin" />
            <p>{scope === "all" ? `Fetching reviews from ${MAJOR_COUNTRIES.length} storefronts…` : "Fetching the latest reviews…"}</p>
          </div>
        ) : error ? (
          <EmptyState
            icon={MessageSquareText}
            title="Could not load reviews"
            description={error instanceof Error ? error.message : undefined}
            action={
              <Button variant="secondary" size="md" onClick={() => void mutate()}>
                <RotateCw aria-hidden className="size-3.5" />
                Retry
              </Button>
            }
          />
        ) : !reviews.length ? (
          <EmptyState icon={MessageSquareText} title="No reviews yet" description="Apple's public feed has no written reviews for this app in this storefront. Try another country or all major countries." />
        ) : (
          <div className="grid gap-4 p-4 lg:grid-cols-[340px_minmax(0,1fr)]">
            <aside className="flex min-w-0 flex-col gap-4">
              <div className="grid grid-cols-2 gap-2">
                <Stat label="App Store rating" value={store ? `★ ${store.app.averageUserRating.toFixed(2)}` : "—"} hint={store ? `${formatCompact(store.app.userRatingCount)} ratings` : scope === "all" ? "Pick a country" : "Loading…"} />
                <Stat label="Recent reviews" value={recentAvg ? `★ ${recentAvg.toFixed(2)}` : "—"} hint={`${reviews.length} latest`} />
                <Stat label="Last 30 days" value={last30Avg ? `★ ${last30Avg.toFixed(2)}` : "—"} hint={`${last30.length} reviews`} />
                <Stat label="Negative share" value={`${Math.round((reviews.filter((r) => r.rating <= 2).length / reviews.length) * 100)}%`} hint="1–2★ reviews" />
              </div>
              <Panel title="Rating distribution">
                <RatingDistribution reviews={reviews} selected={stars} onToggle={toggleStar} />
              </Panel>
              <Panel title="Themes">
                <ThemesPanel
                  reviews={reviews}
                  appName={app.name}
                  active={query.trim().toLowerCase()}
                  onPick={(phrase, s) => {
                    setLimit(PAGE);
                    if (query.trim().toLowerCase() === phrase) {
                      setQuery("");
                      setStars([]);
                      return;
                    }
                    setQuery(phrase);
                    setStars(s);
                  }}
                />
              </Panel>
              {aiReady ? (
                <Panel title="AI summary">
                  <AiSummary key={`${app.trackId}:${scope}`} trackId={app.trackId} scope={scope} appName={app.name} />
                </Panel>
              ) : (
                <p className="caption-style text-subtle flex items-center gap-1.5 px-1">
                  <Sparkles aria-hidden className="size-3" />
                  Add an Anthropic API key in{" "}
                  <Button variant="link" size="none" href="/settings" className="caption-style">
                    Settings
                  </Button>{" "}
                  for AI summaries.
                </p>
              )}
            </aside>

            <section className="flex min-w-0 flex-col gap-3" aria-label="Reviews">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[200px] flex-1">
                  <Search aria-hidden className="text-subtle absolute top-1/2 left-3 size-3.5 -translate-y-1/2" />
                  <Input
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setLimit(PAGE);
                    }}
                    placeholder="Search reviews…"
                    aria-label="Search reviews"
                    className="pl-8"
                  />
                </div>
                <Select
                  value={version}
                  onValueChange={(v) => {
                    setVersion(v);
                    setLimit(PAGE);
                  }}
                >
                  <SelectTrigger aria-label="Version" className="w-auto min-w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-[320px]">
                    <SelectItem value="all">All versions</SelectItem>
                    {versions.map((v) => (
                      <SelectItem key={v} value={v}>
                        Version {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
                  <SelectTrigger aria-label="Sort" className="w-auto min-w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORTS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by stars">
                {[5, 4, 3, 2, 1].map((s) => (
                  <Button key={s} variant={stars.includes(s) ? "muted" : "ghost"} size="sm" aria-pressed={stars.includes(s)} onClick={() => toggleStar(s)}>
                    {s}★
                  </Button>
                ))}
                <span className="caption-style text-subtle ml-auto">
                  {filtered.length} of {reviews.length} reviews
                </span>
                {filtersActive && (
                  <Button variant="ghost" size="sm" onClick={resetFilters}>
                    <X aria-hidden className="size-3" />
                    Clear filters
                  </Button>
                )}
              </div>
              {filtered.length ? (
                <ul className="flex flex-col gap-2">
                  {filtered.slice(0, limit).map((r) => (
                    <li key={`${r.country}:${r.id}`}>
                      <ReviewCard review={r} showCountry={scope === "all"} />
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon={Search} title="No matching reviews" description="Try removing a filter." className="py-10" />
              )}
              {filtered.length > limit && (
                <Button variant="secondary" size="md" className="self-center" onClick={() => setLimit((l) => l + PAGE)}>
                  Show more ({filtered.length - limit} left)
                </Button>
              )}
            </section>
          </div>
        )}
      </div>
    </>
  );
}
