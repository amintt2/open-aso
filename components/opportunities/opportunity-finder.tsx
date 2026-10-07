"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Globe2, Loader2, Plus, Radar, Search } from "lucide-react";
import { toast } from "sonner";
import Button from "@/components/_ui/button";
import CountBadge from "@/components/_ui/count-badge";
import { Input } from "@/components/_ui/input";
import EmptyState from "@/components/shell/empty-state";
import PageHeader from "@/components/shell/page-header";
import WorldMap from "@/components/shell/world-map";
import JobProgress from "@/components/suggestions/job-progress";
import { useJob } from "@/components/suggestions/use-job";
import { useCurrentApp } from "@/hooks/use-app";
import { COUNTRY_BY_CODE } from "@/lib/appstore/countries";
import { api, revalidate, useApi } from "@/lib/client/api";
import { timeAgo } from "@/lib/client/format";
import type { TrackedKeyword } from "@/lib/client/types";
import type { CountryOpportunity, OpportunityScan } from "@/lib/opportunities/types";
import type { JobView } from "@/lib/suggestions/types";
import CountryScope, { scopeCountries, type Scope } from "./country-scope";
import OpportunitiesTable from "./opportunities-table";

type Overview = { last: OpportunityScan | null; running: JobView<OpportunityScan> | null; maxCountries?: number };

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-card border-border flex min-w-0 flex-col gap-2 rounded-xl border p-4">
      <span className="eyebrow-style text-subtle">{label}</span>
      <span title={value} className="truncate text-[20px] leading-none font-medium tabular-nums">
        {value}
      </span>
      {hint && <span className="caption-style text-subtle truncate">{hint}</span>}
    </div>
  );
}

function countryLabel(code: string | undefined) {
  if (!code) return "—";
  const c = COUNTRY_BY_CODE.get(code);
  return c ? `${c.flag} ${c.name}` : code.toUpperCase();
}

export default function OpportunityFinder() {
  const { app, appId, error } = useCurrentApp();
  const { data: overview, mutate: mutateOverview } = useApi<Overview>(app ? `/api/opportunities?appId=${appId}` : null);
  const { data: keywords } = useApi<TrackedKeyword[]>(app ? `/api/apps/${appId}/keywords` : null);
  const [term, setTerm] = useState("");
  const [scope, setScope] = useState<Scope>({ mode: "all", region: "europe", custom: [] });
  const [startedId, setStartedId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focus, setFocus] = useState<string | null>(null);
  const [tracking, setTracking] = useState(false);
  const [pendingTerm, setPendingTerm] = useState<string | null>(null);

  const [prefilled, setPrefilled] = useState(false);
  if (!prefilled && overview) {
    setPrefilled(true);
    if (overview.last && !term) setTerm(overview.last.term);
  }

  const jobId = startedId ?? overview?.running?.id ?? null;
  const job = useJob<OpportunityScan>("/api/opportunities", jobId, (finished) => {
    setStartedId(null);
    mutateOverview();
    if (finished.status === "error") toast.error(finished.error ?? "Scan failed");
  });
  const running = !!jobId && (!job || job.status === "running");
  const scan = job?.status === "done" && job.result ? job.result : overview?.last ?? null;
  const partial = running && Array.isArray(job?.partial) ? (job.partial as CountryOpportunity[]) : null;
  const rows = running ? (partial ?? []) : (scan?.results ?? []);
  const scanTerm = running ? null : scan?.term;
  const mapTerm = running ? (pendingTerm ?? term.trim()) : scan?.term;

  const chips = useMemo(() => {
    const best = new Map<string, number>();
    for (const k of keywords ?? []) best.set(k.term, Math.max(best.get(k.term) ?? 0, k.popularity ?? 0));
    return [...best].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([t]) => t);
  }, [keywords]);

  const trackedCountries = useMemo(() => {
    const t = scanTerm ?? "";
    return new Set((keywords ?? []).filter((k) => k.term === t).map((k) => k.country));
  }, [keywords, scanTerm]);

  const valid = rows.filter((r) => !r.error);
  const values: Record<string, number> = Object.fromEntries(valid.map((r) => [r.country, r.opportunity]));
  const best = [...valid].sort((a, b) => b.opportunity - a.opportunity)[0];
  const loudest = [...valid].sort((a, b) => b.popularity - a.popularity)[0];
  const ranked = valid.filter((r) => r.position != null);
  const easiest = [...valid].filter((r) => r.popularity >= 20).sort((a, b) => a.difficulty - b.difficulty)[0];
  const countries = scopeCountries(scope);
  const maxCountries = overview?.maxCountries ?? countries.length;
  const scanCount = Math.min(countries.length, maxCountries);
  const selectedList = [...selected].filter((c) => !trackedCountries.has(c));

  async function startScan(e?: FormEvent) {
    e?.preventDefault();
    if (!app || !term.trim() || !countries.length) return;
    setStarting(true);
    try {
      const started = await api<JobView<OpportunityScan>>("/api/opportunities", { method: "POST", body: { appId: app.id, term: term.trim(), countries } });
      setStartedId(started.id);
      setPendingTerm(term.trim().toLowerCase());
      setSelected(new Set());
      setFocus(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start scan");
    } finally {
      setStarting(false);
    }
  }

  async function trackSelected() {
    if (!app || !scan || !selectedList.length) return;
    setTracking(true);
    try {
      const ids: number[] = [];
      for (const country of selectedList) {
        const list = await api<TrackedKeyword[]>(`/api/apps/${app.id}/keywords`, { method: "POST", body: { terms: [scan.term], country, analyze: false } });
        list.filter((k) => k.term === scan.term && !k.lastRefreshedAt).forEach((k) => ids.push(k.id));
      }
      if (ids.length) await api("/api/keywords/refresh", { method: "POST", body: { ids } });
      await Promise.all([revalidate(`/api/apps/${app.id}`), revalidate("/api/apps")]);
      toast.success(`Tracking “${scan.term}” in ${selectedList.length} ${selectedList.length === 1 ? "country" : "countries"}`);
      setSelected(new Set());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not track keyword");
    } finally {
      setTracking(false);
    }
  }

  function focusCountry(code: string) {
    setFocus(code);
    document.getElementById(`opp-${code}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  if (error) return <EmptyState icon={Globe2} title="App not found" description="This app is no longer tracked." />;

  return (
    <>
      <PageHeader title="Country Opportunities" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 p-4">
          <form onSubmit={startScan} className="bg-card border-border flex flex-col gap-3 rounded-xl border p-4">
            <div className="flex flex-col gap-2 md:flex-row">
              <div className="relative flex-1">
                <Search aria-hidden className="text-subtle absolute top-1/2 left-3 size-3.5 -translate-y-1/2" />
                <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Keyword to compare across countries" aria-label="Keyword" maxLength={100} className="pl-8" />
              </div>
              <CountryScope value={scope} onChange={setScope} />
              <Button type="submit" variant="primary" size="md" className="h-9 px-4" disabled={!term.trim() || !countries.length || running || starting}>
                {running || starting ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : <Radar aria-hidden className="size-3.5" />}
                Scan {scanCount} {scanCount === 1 ? "country" : "countries"}
              </Button>
            </div>
            {countries.length > maxCountries && (
              <p className="caption-style text-subtle">
                Your plan scans up to {maxCountries} countries at a time, so the {maxCountries} largest markets in this selection go first.
              </p>
            )}
            {chips.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="caption-style text-subtle mr-1">Tracked:</span>
                {chips.map((c) => (
                  <Button key={c} variant={term === c ? "muted" : "subtle"} size="sm" aria-pressed={term === c} onClick={() => setTerm(c)}>
                    {c}
                  </Button>
                ))}
              </div>
            )}
          </form>

          {running && (
            <JobProgress
              stage={job?.stage ?? "Starting scan"}
              done={job?.done ?? 0}
              total={job?.total ?? 0}
              detail="Each storefront is analyzed from live App Store search data. Results stay cached for 24 hours."
            />
          )}

          {rows.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Best opportunity" value={countryLabel(best?.country)} hint={best ? `Score ${best.opportunity}` : undefined} />
                <Stat label="Most searched" value={countryLabel(loudest?.country)} hint={loudest ? `Popularity ${loudest.popularity}` : undefined} />
                <Stat label="Easiest market" value={countryLabel(easiest?.country)} hint={easiest ? `Difficulty ${easiest.difficulty}` : "Needs popularity ≥ 20"} />
                <Stat label="You rank in" value={`${ranked.length}/${valid.length}`} hint="Top 200 results" />
              </div>

              <section aria-labelledby="map-heading" className="bg-card border-border flex flex-col gap-3 rounded-xl border p-4">
                <h2 id="map-heading" className="flex items-center gap-2">
                  Opportunity by country
                  {mapTerm && <span className="text-subtle font-normal">“{mapTerm}”</span>}
                </h2>
                <WorldMap values={values} selected={focus} onSelect={(code) => values[code] != null && focusCountry(code)} legend="Opportunity" />
              </section>

              <section aria-labelledby="results-heading" className="bg-card border-border flex flex-col rounded-xl border">
                <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
                  <div className="flex items-center gap-2">
                    <h2 id="results-heading">Countries</h2>
                    <CountBadge>{rows.length}</CountBadge>
                  </div>
                  <Button variant="primary" size="md" disabled={!selectedList.length || tracking || running} onClick={trackSelected}>
                    {tracking ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : <Plus aria-hidden className="size-3.5" />}
                    {selectedList.length ? `Track in ${selectedList.length} ${selectedList.length === 1 ? "country" : "countries"}` : "Track in countries"}
                  </Button>
                </div>
                <OpportunitiesTable rows={rows} selected={selected} onSelectedChange={setSelected} tracked={trackedCountries} focus={focus} onFocus={focusCountry} />
                <p className="caption-style text-subtle px-4 py-3">
                  {scan && !running ? `Scanned ${timeAgo(scan.scannedAt)}. ` : ""}Popularity, difficulty and search volume are modeled estimates from public App Store data.
                </p>
              </section>
            </>
          ) : (
            !running &&
            overview && (
              <div className="bg-card border-border rounded-xl border">
                <EmptyState
                  icon={Globe2}
                  title="Find where a keyword is easiest to win"
                  description="Pick a keyword and the storefronts to compare. We score popularity, difficulty and your ranking in each one so you can expand into the markets with the best odds."
                />
              </div>
            )
          )}
        </div>
      </div>
    </>
  );
}
