"use client";

import { useMemo, useState } from "react";
import { EyeOff, Eye, KeyRound, Lightbulb, Loader2, Plus, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import Button from "@/components/_ui/button";
import { Checkbox } from "@/components/_ui/checkbox";
import CountBadge from "@/components/_ui/count-badge";
import CountrySelect from "@/components/shell/country-select";
import EmptyState from "@/components/shell/empty-state";
import PageHeader from "@/components/shell/page-header";
import { RelevanceSourceBadge } from "@/components/shell/relevance";
import { useAppCountry, useCurrentApp } from "@/hooks/use-app";
import { api, revalidate, useApi } from "@/lib/client/api";
import { timeAgo } from "@/lib/client/format";
import type { TargetingLabel, TrackedKeyword } from "@/lib/client/types";
import type { JobView, SuggestionsOverview, SuggestionsResult } from "@/lib/suggestions/types";
import { cn } from "@/lib/utils";
import InsightsPanel from "./insights-panel";
import JobProgress from "./job-progress";
import SuggestionsTable from "./suggestions-table";
import { useJob } from "./use-job";

const MIN_TRACKED = 3;

export default function SuggestionsView() {
  const { app, appId, error } = useCurrentApp();
  const [country, setCountry] = useAppCountry(app);
  const overviewUrl = app ? `/api/suggestions?appId=${appId}&country=${country}` : null;
  const keywordsUrl = app ? `/api/apps/${appId}/keywords?country=${country}` : null;
  const { data: overview, mutate: mutateOverview } = useApi<SuggestionsOverview>(overviewUrl);
  const { data: tracked } = useApi<TrackedKeyword[]>(keywordsUrl);
  const [startedJob, setStartedJob] = useState<{ id: string; scope: string } | null>(null);
  const [starting, setStarting] = useState(false);
  const [useAi, setUseAi] = useState(true);
  const [labelFilter, setLabelFilter] = useState<TargetingLabel | "all">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [showFiltered, setShowFiltered] = useState(false);

  const scope = `${appId}:${country}`;
  const jobId = (startedJob?.scope === scope ? startedJob.id : null) ?? overview?.running?.id ?? null;
  const job = useJob<SuggestionsResult>("/api/suggestions", jobId, (finished: JobView<SuggestionsResult>) => {
    setStartedJob(null);
    mutateOverview();
    if (finished.status === "error") toast.error(finished.error ?? "Could not generate suggestions");
    else if (finished.result?.aiError) toast.warning(`AI ideas skipped: ${finished.result.aiError}`);
    if (finished.result?.relevanceError) toast.warning(`Jev relevance partly unavailable, used the heuristic instead: ${finished.result.relevanceError}`);
  });
  const running = !!jobId && (!job || job.status === "running");
  const result = job?.status === "done" && job.result ? job.result : overview?.last ?? null;

  const trackedTerms = useMemo(() => new Set((tracked ?? []).map((k) => k.term)), [tracked]);
  const rows = useMemo(() => (result?.suggestions ?? []).filter((s) => !trackedTerms.has(s.term)), [result, trackedTerms]);
  const labelCounts = useMemo(() => {
    const counts = new Map<TargetingLabel, number>();
    rows.forEach((r) => counts.set(r.label, (counts.get(r.label) ?? 0) + 1));
    return [...counts].sort((a, b) => b[1] - a[1]);
  }, [rows]);
  const visible = labelFilter === "all" ? rows : rows.filter((r) => r.label === labelFilter);
  const filtered = useMemo(() => (result?.filtered ?? []).filter((f) => !trackedTerms.has(f.term)), [result, trackedTerms]);
  const selectedVisible = [...selected].filter((t) => rows.some((r) => r.term === t));
  const trackedCount = tracked?.length ?? overview?.trackedCount ?? 0;
  const unlocked = trackedCount >= MIN_TRACKED;

  async function generate() {
    if (!app) return;
    setStarting(true);
    try {
      const started = await api<JobView<SuggestionsResult>>("/api/suggestions", { method: "POST", body: { appId: app.id, country, useAi: useAi && !!overview?.aiAvailable } });
      setStartedJob({ id: started.id, scope });
      setSelected(new Set());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start");
    } finally {
      setStarting(false);
    }
  }

  async function addSelected() {
    if (!app || !selectedVisible.length) return;
    setAdding(true);
    try {
      const list = await api<TrackedKeyword[]>(`/api/apps/${app.id}/keywords`, { method: "POST", body: { terms: selectedVisible, country, analyze: false } });
      const ids = list.filter((k) => selectedVisible.includes(k.term) && !k.lastRefreshedAt).map((k) => k.id);
      if (ids.length) await api("/api/keywords/refresh", { method: "POST", body: { ids } });
      await Promise.all([revalidate(`/api/apps/${app.id}`), revalidate("/api/apps"), revalidate("/api/insights")]);
      toast.success(`Tracking ${selectedVisible.length} new ${selectedVisible.length === 1 ? "keyword" : "keywords"}`);
      setSelected(new Set());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add keywords");
    } finally {
      setAdding(false);
    }
  }

  if (error) return <EmptyState icon={Lightbulb} title="App not found" description="This app is no longer tracked." />;

  const actions = app && (
    <>
      <CountrySelect value={country} onChange={(c) => setCountry(c)} />
      {overview?.aiAvailable ? (
        <label className="caption-style text-soft flex cursor-pointer items-center gap-2 px-1">
          <Checkbox checked={useAi} onCheckedChange={(v) => setUseAi(v === true)} aria-label="Include AI ideas" />
          <span className="hidden sm:inline">Include AI ideas</span>
          <Sparkles aria-hidden className="size-3.5 sm:hidden" />
        </label>
      ) : (
        <Button variant="ghost" size="sm" href="/settings" title="Add an Anthropic API key in Settings to include AI ideas" aria-label="Enable AI ideas">
          <Sparkles aria-hidden className="size-3.5" />
          <span className="hidden sm:inline">Enable AI ideas</span>
        </Button>
      )}
      <Button variant="primary" size="md" onClick={generate} disabled={!unlocked || running || starting}>
        {running || starting ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : <Wand2 aria-hidden className="size-3.5" />}
        {result ? "Regenerate" : "Generate"}
      </Button>
    </>
  );

  return (
    <>
      <PageHeader title="Suggestions" actions={actions} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 p-4">
          {app && <InsightsPanel key={`${app.id}:${country}`} app={app} country={country} />}

          {!tracked || !overview ? (
            <div className="bg-card border-border text-subtle flex items-center gap-2 rounded-xl border p-6">
              <Loader2 aria-hidden className="size-4 animate-spin" />
              Loading suggestions…
            </div>
          ) : !unlocked ? (
            <div className="bg-card border-border rounded-xl border">
              <EmptyState
                icon={KeyRound}
                title={`Add at least ${MIN_TRACKED} keywords to unlock suggestions`}
                description={`Suggestions build on the keywords you already track in this country. You have ${trackedCount} so far.`}
                action={
                  <Button variant="primary" size="md" href={`/apps/${appId}/keywords`}>
                    <Plus aria-hidden className="size-3.5" />
                    Add keywords
                  </Button>
                }
              />
            </div>
          ) : (
            <>
              {running && (
                <JobProgress
                  stage={job?.stage ?? "Starting"}
                  done={job?.done ?? 0}
                  total={job?.total ?? 0}
                  detail={
                    job?.stage.startsWith("Judging")
                      ? "Checking every candidate against your listing so only keywords that fit your app get scored."
                      : typeof job?.partial === "number"
                        ? `${job.partial} keywords scored so far. Lookups are cached, so the next run is faster.`
                        : "Gathering search hints, top app titles and competitor names."
                  }
                />
              )}

              {result && rows.length > 0 ? (
                <section aria-labelledby="suggestions-heading" className="bg-card border-border flex flex-col rounded-xl border">
                  <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
                    <div className="flex items-center gap-2">
                      <h2 id="suggestions-heading">Keyword ideas</h2>
                      <CountBadge>{rows.length}</CountBadge>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {filtered.length > 0 && (
                        <Button variant="ghost" size="md" aria-pressed={showFiltered} onClick={() => setShowFiltered((v) => !v)}>
                          {showFiltered ? <EyeOff aria-hidden className="size-3.5" /> : <Eye aria-hidden className="size-3.5" />}
                          {showFiltered ? "Hide filtered out" : `Show filtered out (${filtered.length})`}
                        </Button>
                      )}
                      <Button variant="primary" size="md" disabled={!selectedVisible.length || adding} onClick={addSelected}>
                        {adding ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : <Plus aria-hidden className="size-3.5" />}
                        {selectedVisible.length ? `Add ${selectedVisible.length} to tracked` : "Add to tracked"}
                      </Button>
                    </div>
                  </div>
                  <div role="group" aria-label="Filter by label" className="border-border flex flex-wrap gap-1.5 border-b px-4 py-2.5">
                    {[["all", rows.length] as const, ...labelCounts].map(([label, count]) => (
                      <Button
                        key={label}
                        variant={labelFilter === label ? "muted" : "ghost"}
                        size="sm"
                        aria-pressed={labelFilter === label}
                        onClick={() => setLabelFilter(label)}
                        className={cn(labelFilter === label && "text-foreground")}
                      >
                        {label === "all" ? "All" : label}
                        <span className="text-subtle tabular-nums">{count}</span>
                      </Button>
                    ))}
                  </div>
                  <SuggestionsTable rows={visible} filtered={showFiltered ? filtered : []} selected={selected} onSelectedChange={setSelected} />
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 px-4 py-3">
                    {result.relevanceSource && <RelevanceSourceBadge source={result.relevanceSource} />}
                    <p className="caption-style text-subtle">
                      Generated {timeAgo(result.generatedAt)}.{" "}
                      {result.judged != null
                        ? `Judged ${result.judged} candidates for relevance${result.usedAi ? " (including AI ideas)" : ""}, kept ${result.kept ?? 0} and scored the top ${result.suggestions.length}.`
                        : `From ${result.candidatesConsidered} candidates${result.usedAi ? ", including AI ideas" : ""}.`}{" "}
                      Score = relevance × opportunity. Popularity, difficulty and downloads are modeled estimates.
                    </p>
                  </div>
                </section>
              ) : (
                !running && (
                  <div className="bg-card border-border rounded-xl border">
                    <EmptyState
                      icon={Lightbulb}
                      title={result ? "No new ideas this time" : "Find keywords you're missing"}
                      description={
                        result
                          ? "Everything we found is already tracked. Track a few more varied keywords and regenerate."
                          : "We mine search hints, top-ranking app titles, your listing and competitors, then score each idea for this storefront."
                      }
                      action={
                        <Button variant="primary" size="md" onClick={generate} disabled={!unlocked || starting || !app}>
                          <Wand2 aria-hidden className="size-3.5" />
                          Generate suggestions
                        </Button>
                      }
                    />
                  </div>
                )
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
