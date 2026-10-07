"use client";

import { useApi } from "@/lib/client/api";
import type { KeywordTrend } from "@/lib/apple-ads/types";
import { DetailSheet, DiagnosisBadge, ErrorNote, LoadingRows, Stat } from "./bits";
import { MiniChart, SERIES } from "./charts";
import { count, money, pct } from "./format";
import { useAdsUi } from "./store";

export default function KeywordTrendSheet() {
  const k = useAdsUi((s) => s.trend);
  const demo = useAdsUi((s) => s.demo);
  const days = useAdsUi((s) => s.days);
  const openTrend = useAdsUi((s) => s.openTrend);
  const { data, error, isLoading } = useApi<KeywordTrend>(k ? `/api/apple-ads/keywords/${k.id}/trend${demo ? "?demo=1" : ""}` : null);
  const points = (data?.points ?? []).slice(-days);
  const currency = data?.currency ?? "USD";

  return (
    <DetailSheet
      open={k !== null}
      onOpenChange={(o) => !o && openTrend(null)}
      width="sm:max-w-[820px]"
      title={k ? `“${k.text}”` : "Keyword"}
      description={k ? `${k.matchType === "EXACT" ? "Exact" : "Broad"} match · last ${days} days · daily data stored locally` : undefined}
    >
      <ErrorNote error={error} />
      {isLoading && <LoadingRows />}
      {k && (
        <div className="flex flex-col gap-5 p-6">
          <div className="bg-card border-border flex flex-col gap-3 rounded-xl border p-4">
            <div className="flex items-center gap-2">
              <DiagnosisBadge diagnosis={k.diagnosis} />
              <span className="caption-style text-subtle">{k.diagnosis.rule}</span>
            </div>
            <p className="text-soft">{k.diagnosis.why}</p>
            {k.suggestion && (
              <p className="text-[13px]">
                Suggested bid {money(k.suggestion.current, currency)} → <span className="text-foreground font-medium">{money(k.suggestion.suggested, currency)}</span>
                {k.suggestion.capped && <span className="text-subtle"> (capped at ±30%)</span>}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-4">
            <Stat label="Bid" value={money(k.bid, currency)} />
            <Stat label="Spend" value={money(k.metrics.spend, currency)} />
            <Stat label="Taps" value={count(k.metrics.taps)} />
            <Stat label="Installs" value={count(k.metrics.installs)} />
            <Stat label="TTR" value={pct(k.metrics.ttr)} />
            <Stat label="CR" value={pct(k.metrics.cr)} />
            <Stat label="CPA" value={money(k.metrics.cpa, currency)} />
          </div>
          {points.length > 0 && (
            <div className="grid gap-4">
              <MiniChart title="Spend" data={points} dataKey="spend" kind="bar" color={SERIES.spend} format={(v) => money(v, currency)} axisFormat={(v) => money(v, currency, 0)} />
              <MiniChart title="Installs" data={points} dataKey="installs" kind="area" color={SERIES.installs} format={(v) => count(v)} />
              <MiniChart title="CPA" data={points} dataKey="cpa" kind="area" color={SERIES.cpa} format={(v) => money(v, currency)} axisFormat={(v) => money(v, currency, 0)} />
            </div>
          )}
          {data && !points.length && <p className="text-subtle">No daily rows stored for this keyword yet.</p>}
        </div>
      )}
    </DetailSheet>
  );
}
