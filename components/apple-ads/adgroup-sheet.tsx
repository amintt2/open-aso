"use client";

import { useMemo, useState } from "react";
import { LineChart, MinusCircle, Plus, Sparkles } from "lucide-react";
import Button from "@/components/_ui/button";
import Tag from "@/components/_ui/tag";
import { Checkbox } from "@/components/_ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import { useApi } from "@/lib/client/api";
import type { AdGroupDetail, AdsKeyword } from "@/lib/apple-ads/types";
import { cn } from "@/lib/utils";
import { DetailSheet, DiagnosisBadge, ErrorNote, InlineMoney, LoadingRows, SearchMatchTag, Stat, StatusToggle } from "./bits";
import { KindTag } from "./campaign-sheet";
import { useRequestChange } from "./change-provider";
import { count, money, multiple, pct, signedPct } from "./format";
import { useAdsQuery, useAdsUi } from "./store";

function shareLabel(k: AdsKeyword) {
  if (!k.impressionShare) return "—";
  return `${Math.round(k.impressionShare.low * 100)}–${Math.round(k.impressionShare.high * 100)}%`;
}

export default function AdGroupSheet() {
  const ref = useAdsUi((s) => s.adGroup);
  const openAdGroup = useAdsUi((s) => s.openAdGroup);
  const openTrend = useAdsUi((s) => s.openTrend);
  const openAddKeywords = useAdsUi((s) => s.openAddKeywords);
  const openAddNegatives = useAdsUi((s) => s.openAddNegatives);
  const query = useAdsQuery();
  const request = useRequestChange();
  const base = ref ? `/api/apple-ads/campaigns/${ref.campaignId}/adgroups/${ref.adGroupId}` : null;
  const { data, error, isLoading } = useApi<AdGroupDetail>(base ? `${base}?${query}` : null);
  const [selection, setSelection] = useState<{ key: string; ids: Set<string> }>({ key: "", ids: new Set() });
  const selected = useMemo(() => (selection.key === base ? selection.ids : new Set<string>()), [selection, base]);
  const setSelected = (ids: Set<string>) => setSelection({ key: base ?? "", ids });

  const keywords = data?.keywords ?? [];
  const currency = data?.campaign.currency ?? "USD";
  const hasRoas = keywords.some((k) => k.attribution && k.attribution.installs > 0);
  const hasShare = keywords.some((k) => k.impressionShare);
  const suggestions = keywords.filter((k) => k.suggestion && (selected.size === 0 || selected.has(k.id)));
  const g = data?.adGroup;

  function toggle(id: string, on: boolean) {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    setSelected(next);
  }

  function setStatus(ids: string[], status: "ACTIVE" | "PAUSED") {
    if (!base || !ids.length) return;
    request({
      title: `${status === "PAUSED" ? "Pause" : "Enable"} ${ids.length} keyword${ids.length === 1 ? "" : "s"}`,
      url: `${base}/keywords`,
      method: "PATCH",
      body: { updates: ids.map((keywordId) => ({ keywordId, status })) },
      onDone: () => setSelected(new Set()),
    });
  }

  function applySuggestions(list: AdsKeyword[]) {
    if (!base || !list.length) return;
    request({
      title: `Apply ${list.length} suggested bid${list.length === 1 ? "" : "s"}`,
      description: "Suggested bids follow the playbook rules and never move more than 30% at once.",
      url: `${base}/keywords`,
      method: "PATCH",
      body: { updates: list.map((k) => ({ keywordId: k.id, bid: k.suggestion?.suggested })), enforceCaps: true },
      onDone: () => setSelected(new Set()),
    });
  }

  return (
    <DetailSheet
      open={ref !== null}
      onOpenChange={(o) => !o && openAdGroup(null)}
      width="sm:max-w-[1180px]"
      title={g?.name ?? "Ad group"}
      description={data ? `${data.campaign.name} · default bid ${money(g?.defaultBid, currency)}` : undefined}
      actions={
        ref && (
          <>
            <Button variant="secondary" size="sm" onClick={() => openAddNegatives({ campaignId: ref.campaignId, adGroupId: ref.adGroupId })}>
              <MinusCircle aria-hidden className="size-3.5" />
              Negatives
            </Button>
            <Button variant="muted" size="sm" onClick={() => openAddKeywords(ref)}>
              <Plus aria-hidden className="size-3.5" />
              Keywords
            </Button>
          </>
        )
      }
    >
      <ErrorNote error={error} />
      {isLoading && <LoadingRows rows={6} />}
      {g && data && (
        <div className="flex flex-col gap-5 p-6">
          <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
            <Stat label="Type" value={<KindTag kind={g.kind} />} />
            <Stat label="Search Match" value={<SearchMatchTag on={g.searchMatch} />} />
            <Stat label="Spend" value={money(g.metrics.spend, currency)} />
            <Stat label="Installs" value={count(g.metrics.installs)} />
            <Stat label="CPA" value={money(g.metrics.cpa, currency)} />
            <Stat label="TTR" value={pct(g.metrics.ttr)} />
            {g.cpaGoal != null && <Stat label="CPA goal" value={money(g.cpaGoal, currency)} />}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <h3 className="mr-auto">Keywords</h3>
            {selected.size > 0 && (
              <>
                <span className="caption-style text-subtle">{selected.size} selected</span>
                <Button variant="secondary" size="sm" onClick={() => setStatus([...selected], "PAUSED")}>
                  Pause
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setStatus([...selected], "ACTIVE")}>
                  Enable
                </Button>
              </>
            )}
            <Button variant="muted" size="sm" disabled={!suggestions.length} onClick={() => applySuggestions(suggestions)}>
              <Sparkles aria-hidden className="size-3.5" />
              Apply {suggestions.length || ""} suggested bid{suggestions.length === 1 ? "" : "s"}
            </Button>
          </div>

          <div className="border-border overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8 pr-0">
                    <Checkbox
                      aria-label="Select all keywords"
                      checked={keywords.length > 0 && selected.size === keywords.length ? true : selected.size > 0 ? "indeterminate" : false}
                      onCheckedChange={(v) => setSelected(v === true ? new Set(keywords.map((k) => k.id)) : new Set())}
                    />
                  </TableHead>
                  <TableHead className="w-10" />
                  <TableHead>Keyword</TableHead>
                  <TableHead>Match</TableHead>
                  <TableHead>Diagnosis</TableHead>
                  <TableHead>Bid</TableHead>
                  <TableHead>Suggested bid</TableHead>
                  <TableHead className="text-right">Apple hint</TableHead>
                  {hasShare && <TableHead className="text-right">Impr. share</TableHead>}
                  <TableHead className="text-right">Impr.</TableHead>
                  <TableHead className="text-right">Taps</TableHead>
                  <TableHead className="text-right">Installs</TableHead>
                  <TableHead className="text-right">Spend</TableHead>
                  <TableHead className="text-right">CPT</TableHead>
                  <TableHead className="text-right">CPA</TableHead>
                  {hasRoas && <TableHead className="text-right">ROAS</TableHead>}
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {keywords.map((k) => (
                  <TableRow key={k.id} data-state={selected.has(k.id) ? "selected" : undefined} className={cn("hover:bg-white/2", k.status === "PAUSED" && "text-subtle")}>
                    <TableCell className="pr-0">
                      <Checkbox aria-label={`Select ${k.text}`} checked={selected.has(k.id)} onCheckedChange={(v) => toggle(k.id, v === true)} />
                    </TableCell>
                    <TableCell className="pr-0">
                      <StatusToggle active={k.status === "ACTIVE"} label={k.text} onToggle={() => setStatus([k.id], k.status === "ACTIVE" ? "PAUSED" : "ACTIVE")} />
                    </TableCell>
                    <TableCell className="max-w-[220px]">
                      <button type="button" onClick={() => openTrend(k)} className="flex max-w-full cursor-pointer items-center gap-1.5 text-left hover:underline">
                        <span className="truncate">{k.text}</span>
                      </button>
                    </TableCell>
                    <TableCell>
                      <Tag tone={k.matchType === "EXACT" ? "blue" : "orange"} size="sm" className="caption-style">
                        {k.matchType === "EXACT" ? "Exact" : "Broad"}
                      </Tag>
                    </TableCell>
                    <TableCell>
                      <DiagnosisBadge diagnosis={k.diagnosis} />
                    </TableCell>
                    <TableCell>
                      <InlineMoney
                        value={k.bid}
                        muted={k.bidIsDefault}
                        currency={currency}
                        label={`bid for ${k.text}`}
                        onCommit={(next) => base && request({ title: "Change keyword bid", url: `${base}/keywords`, method: "PATCH", body: { updates: [{ keywordId: k.id, bid: next }] } })}
                      />
                    </TableCell>
                    <TableCell>
                      {k.suggestion ? (
                        <button
                          type="button"
                          title={k.suggestion.why}
                          onClick={() => applySuggestions([k])}
                          className="hover:bg-white/6 -mx-1.5 inline-flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 tabular-nums"
                        >
                          {money(k.suggestion.suggested, currency)}
                          <span className={cn("caption-style", k.suggestion.changePct > 0 ? "text-trend" : "text-warning")}>{signedPct(k.suggestion.changePct)}</span>
                        </button>
                      ) : (
                        <span className="text-subtle">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-subtle text-right tabular-nums">{money(k.suggestedBid, currency)}</TableCell>
                    {hasShare && <TableCell className="text-right tabular-nums">{shareLabel(k)}</TableCell>}
                    <TableCell className="text-right tabular-nums">{count(k.metrics.impressions)}</TableCell>
                    <TableCell className="text-right tabular-nums">{count(k.metrics.taps)}</TableCell>
                    <TableCell className="text-right tabular-nums">{count(k.metrics.installs)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(k.metrics.spend, currency)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(k.metrics.cpt, currency)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(k.metrics.cpa, currency)}</TableCell>
                    {hasRoas && <TableCell className="text-right tabular-nums">{k.attribution && k.attribution.installs > 0 ? multiple(k.attribution.roas) : "—"}</TableCell>}
                    <TableCell className="pl-0">
                      <Button variant="ghost" size="icon-sm" aria-label={`Trend for ${k.text}`} onClick={() => openTrend(k)}>
                        <LineChart aria-hidden className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!keywords.length && (
                  <TableRow>
                    <TableCell colSpan={17} className="text-subtle py-6 text-center">
                      {g.searchMatch ? "Search Match group: Apple chooses the queries. Add exact negatives to keep it off your exact keywords." : "No keywords yet."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <p className="caption-style text-subtle">Grey bids use the ad group default. Hover a diagnosis to see the rule behind it. Apple hint is Apple&apos;s suggested bid; start below it.</p>

          <section className="flex flex-col gap-3">
            <h3>Negative keywords</h3>
            {data.negatives.length || data.campaignNegatives.length ? (
              <div className="flex flex-wrap gap-1.5">
                {data.negatives.map((n) => (
                  <Tag key={n.id} tone="red" size="sm" className="caption-style">
                    {n.text} · {n.matchType.toLowerCase()}
                  </Tag>
                ))}
                {data.campaignNegatives.map((n) => (
                  <Tag key={n.id} tone="neutral" size="sm" className="caption-style" title="Campaign-level negative">
                    {n.text} · {n.matchType.toLowerCase()} · campaign
                  </Tag>
                ))}
              </div>
            ) : (
              <p className="text-subtle">No negatives on this ad group.</p>
            )}
          </section>
        </div>
      )}
    </DetailSheet>
  );
}
