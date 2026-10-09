"use client";

import { useMemo, useState } from "react";
import { History, KeyRound, LineChart } from "lucide-react";
import { Switch } from "radix-ui";
import Button from "@/components/_ui/button";
import { ErrorBlock, LoadingBlock } from "@/components/analytics/parts";
import CountrySelect from "@/components/shell/country-select";
import EmptyState from "@/components/shell/empty-state";
import PageHeader from "@/components/shell/page-header";
import { ALL_COUNTRIES, useAppCountry, useCurrentApp } from "@/hooks/use-app";
import { useApi } from "@/lib/client/api";
import type { TrendDays, TrendKeyword, TrendsResult } from "@/lib/trends/types";
import { cn } from "@/lib/utils";
import CountryBreakdown from "./country-breakdown";
import DistributionChart from "./distribution-chart";
import KeywordCompare from "./keyword-compare";
import KeywordHeatmap from "./keyword-heatmap";
import TrendKeywordSheets, { type SheetPanel } from "./trend-keyword-sheets";
import TrendMovers from "./trend-movers";
import { countryName, latest } from "./trends-format";
import TrendsKpis from "./trends-kpis";
import VisibilityChart, { Segmented } from "./visibility-chart";

const PERIODS: { key: `${TrendDays}`; label: string }[] = [
  { key: "7", label: "7d" },
  { key: "30", label: "30d" },
  { key: "90", label: "90d" },
  { key: "365", label: "1y" },
];

const DEFAULT_COMPARE = 5;

function defaultSelection(keywords: TrendKeyword[]) {
  return keywords
    .filter((k) => k.since != null)
    .sort((a, b) => (latest(b.popularity, b.since) ?? -1) - (latest(a.popularity, a.since) ?? -1))
    .slice(0, DEFAULT_COMPARE)
    .map((k) => k.id);
}

function IncludeToggle({ checked, onChange }: { checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <label htmlFor="trends-include" className="caption-style text-soft flex h-[30px] cursor-pointer items-center gap-2" title="Include keywords judged unrelated to your app or brand terms">
      <Switch.Root
        id="trends-include"
        checked={checked}
        onCheckedChange={onChange}
        className={cn(
          "focus-visible:ring-ring/60 relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-(--line-strong) bg-[#2a2a2a] transition-colors duration-150 outline-none focus-visible:ring-2",
          "data-[state=checked]:border-(--tag-green-border) data-[state=checked]:bg-(--trend)",
        )}
      >
        <Switch.Thumb className="block size-3.5 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform duration-150 data-[state=checked]:translate-x-[17px]" />
      </Switch.Root>
      Include unrelated
    </label>
  );
}

export default function TrendsView() {
  const { app, appId, error: appError } = useCurrentApp();
  const [stored, setCountry] = useAppCountry(app, { allowAll: true });
  const [days, setDays] = useState<TrendDays>(30);
  const [includeAll, setIncludeAll] = useState(false);
  const [selection, setSelection] = useState<{ scope: string; ids: number[] } | null>(null);
  const [panel, setPanel] = useState<SheetPanel>(null);
  const countries = useMemo(() => (app ? [...new Set([app.primaryCountry, ...app.countries])] : []), [app]);
  const country = stored === ALL_COUNTRIES || countries.includes(stored) ? stored : ALL_COUNTRIES;
  const allMode = country === ALL_COUNTRIES;
  const { data, error } = useApi<TrendsResult>(app ? `/api/apps/${appId}/trends?country=${country}&days=${days}${includeAll ? "&include=all" : ""}` : null, {
    keepPreviousData: true,
  });

  const scope = `${country}:${includeAll}`;
  const keywords = useMemo(() => data?.keywords ?? [], [data]);
  const byId = useMemo(() => new Map(keywords.map((k) => [k.id, k])), [keywords]);
  const selected = useMemo(
    () => (selection?.scope === scope ? selection.ids.filter((id) => byId.has(id)) : defaultSelection(keywords)),
    [selection, scope, byId, keywords],
  );
  const multiCountry = new Set(keywords.map((k) => k.country)).size > 1;
  const open = (id: number) => setPanel({ type: "detail", id });

  if (appError) return <EmptyState icon={LineChart} title="App not found" description="This app is no longer tracked." />;

  const summary = data && (
    <p className="caption-style text-subtle">
      {data.from} → {data.to} · {data.keywords.length} {data.keywords.length === 1 ? "keyword" : "keywords"}
      {allMode ? " in all countries" : ` in ${countryName(data.country)}`}
      {data.excluded > 0 && !data.includeAll ? ` · ${data.excluded} unrelated or brand ${data.excluded === 1 ? "keyword" : "keywords"} excluded` : ""} · installs are modelled estimates
    </p>
  );

  function body(d: TrendsResult) {
    if (!d.keywords.length)
      return d.excluded > 0 ? (
        <EmptyState
          icon={KeyRound}
          title="Only unrelated or brand keywords here"
          description="These keywords are left out of the index by default."
          action={
            <Button variant="secondary" size="md" onClick={() => setIncludeAll(true)}>
              Include them
            </Button>
          }
        />
      ) : (
        <EmptyState
          icon={KeyRound}
          title={allMode ? "No keywords tracked yet" : `No keywords tracked in ${countryName(country)}`}
          description="Track keywords to follow their rankings, popularity and difficulty over time."
          action={
            <Button variant="primary" size="md" href={`/apps/${appId}/keywords`}>
              Go to Keywords
            </Button>
          }
        />
      );
    if (d.historyDays < 2)
      return (
        <>
          <TrendsKpis start={null} end={d.kpis.end} />
          <EmptyState
            icon={History}
            title="Not enough history yet"
            description="History builds up daily — keywords are refreshed automatically every day. Trends appear once there are at least two days of rankings."
            className="bg-card border-border rounded-xl border"
          />
        </>
      );
    const from = d.baselineIndex ?? 0;
    return (
      <>
        <TrendsKpis start={d.kpis.start} end={d.kpis.end} />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <VisibilityChart points={d.points} versions={d.versions} days={d.days} />
          <DistributionChart points={d.points} days={d.days} />
        </div>
        <TrendMovers gainers={d.movers.gainers} losers={d.movers.losers} keywords={byId} from={from} multiCountry={multiCountry} onOpen={open} />
        {allMode && d.countries.length > 1 && <CountryBreakdown countries={d.countries} onSelect={setCountry} />}
        <KeywordCompare
          keywords={keywords}
          dates={d.dates}
          versions={d.versions}
          selected={selected}
          multiCountry={multiCountry}
          onSelect={(ids) => setSelection({ scope, ids })}
        />
        <KeywordHeatmap keywords={keywords} dates={d.dates} baselineIndex={d.baselineIndex} multiCountry={multiCountry} onOpen={open} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Rankings & Trends"
        actions={
          <div className="flex max-w-[calc(100vw-2rem)] flex-wrap items-center gap-2">
            <CountrySelect value={country} onChange={setCountry} only={countries} allOption={{ value: ALL_COUNTRIES, label: "All countries" }} />
            <Segmented label="Period" value={`${days}`} options={PERIODS} onChange={(v) => setDays(Number(v) as TrendDays)} />
            <IncludeToggle checked={includeAll} onChange={setIncludeAll} />
          </div>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 p-4">
          {error ? <ErrorBlock message={error.message} /> : !data ? <LoadingBlock /> : (
            <>
              {summary}
              {body(data)}
            </>
          )}
        </div>
      </div>
      {app && <TrendKeywordSheets app={app} panel={panel} onPanel={setPanel} />}
    </>
  );
}
