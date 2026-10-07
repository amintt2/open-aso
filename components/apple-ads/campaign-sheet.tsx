"use client";

import { ChevronRight, MinusCircle, Plus } from "lucide-react";
import Button from "@/components/_ui/button";
import Tag from "@/components/_ui/tag";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import { useApi } from "@/lib/client/api";
import type { AdGroupKind, AdsAdGroup, CampaignDetail } from "@/lib/apple-ads/types";
import { DetailSheet, ErrorNote, InlineMoney, LoadingRows, SearchMatchTag, Stat, StatusTag, StatusToggle } from "./bits";
import { useRequestChange } from "./change-provider";
import { count, countryLabel, money, multiple, pct } from "./format";
import { useAdsQuery, useAdsUi } from "./store";

const KIND: Record<AdGroupKind, { label: string; tone: "blue" | "orange" | "purple" | "neutral" | "amber" }> = {
  exact: { label: "Exact", tone: "blue" },
  broad: { label: "Broad", tone: "orange" },
  search_match: { label: "Search Match", tone: "purple" },
  mixed: { label: "Mixed", tone: "amber" },
  empty: { label: "No keywords", tone: "neutral" },
};

export function KindTag({ kind }: { kind: AdGroupKind }) {
  return (
    <Tag tone={KIND[kind].tone} size="sm" className="caption-style">
      {KIND[kind].label}
    </Tag>
  );
}

function AdGroupRow({ g, currency, campaignId }: { g: AdsAdGroup; currency: string; campaignId: string }) {
  const request = useRequestChange();
  const openAdGroup = useAdsUi((s) => s.openAdGroup);
  const url = `/api/apple-ads/campaigns/${campaignId}/adgroups/${g.id}`;
  return (
    <TableRow className="hover:bg-white/2">
      <TableCell className="pr-0">
        <StatusToggle
          active={g.status === "ENABLED"}
          label={g.name}
          onToggle={() => request({ title: `${g.status === "ENABLED" ? "Pause" : "Enable"} ad group`, url, method: "PATCH", body: { status: g.status === "ENABLED" ? "PAUSED" : "ENABLED" } })}
        />
      </TableCell>
      <TableCell className="max-w-[300px]">
        <button type="button" title={g.name} onClick={() => openAdGroup({ campaignId, adGroupId: g.id })} className="block max-w-full cursor-pointer truncate text-left hover:underline">
          {g.name}
        </button>
      </TableCell>
      <TableCell>
        <StatusTag status={g.status} display={g.displayStatus} />
      </TableCell>
      <TableCell>
        <KindTag kind={g.kind} />
      </TableCell>
      <TableCell>
        <button
          type="button"
          className="cursor-pointer"
          title="Toggle Search Match"
          onClick={() => request({ title: `Turn Search Match ${g.searchMatch ? "off" : "on"}`, url, method: "PATCH", body: { searchMatch: !g.searchMatch } })}
        >
          <SearchMatchTag on={g.searchMatch} />
        </button>
      </TableCell>
      <TableCell>
        <InlineMoney value={g.defaultBid} currency={currency} label={`default bid of ${g.name}`} onCommit={(next) => request({ title: "Change default bid", url, method: "PATCH", body: { defaultBid: next } })} />
      </TableCell>
      <TableCell className="text-right tabular-nums">{g.keywordCount}</TableCell>
      <TableCell className="text-right tabular-nums">{money(g.metrics.spend, currency)}</TableCell>
      <TableCell className="text-right tabular-nums">{count(g.metrics.impressions)}</TableCell>
      <TableCell className="text-right tabular-nums">{count(g.metrics.taps)}</TableCell>
      <TableCell className="text-right tabular-nums">{count(g.metrics.installs)}</TableCell>
      <TableCell className="text-right tabular-nums">{pct(g.metrics.ttr)}</TableCell>
      <TableCell className="text-right tabular-nums">{money(g.metrics.cpt, currency)}</TableCell>
      <TableCell className="text-right tabular-nums">{money(g.metrics.cpa, currency)}</TableCell>
      <TableCell className="pl-0">
        <button type="button" aria-label={`Open ${g.name}`} onClick={() => openAdGroup({ campaignId, adGroupId: g.id })} className="text-subtle hover:text-foreground cursor-pointer">
          <ChevronRight aria-hidden className="size-4" />
        </button>
      </TableCell>
    </TableRow>
  );
}

export default function CampaignSheet() {
  const campaignId = useAdsUi((s) => s.campaignId);
  const openCampaign = useAdsUi((s) => s.openCampaign);
  const openCreateAdGroup = useAdsUi((s) => s.openCreateAdGroup);
  const openAddNegatives = useAdsUi((s) => s.openAddNegatives);
  const query = useAdsQuery();
  const request = useRequestChange();
  const { data, error, isLoading } = useApi<CampaignDetail>(campaignId ? `/api/apple-ads/campaigns/${campaignId}?${query}` : null);
  const c = data?.campaign;

  return (
    <DetailSheet
      open={campaignId !== null}
      onOpenChange={(o) => !o && openCampaign(null)}
      title={c?.name ?? "Campaign"}
      description={c ? `${c.countries.map(countryLabel).join(", ")} · Search Results · ${c.biddingStrategy?.replaceAll("_", " ").toLowerCase() ?? "manual CPT"}` : undefined}
      actions={
        c && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => request({ title: `${c.status === "ENABLED" ? "Pause" : "Enable"} campaign`, url: `/api/apple-ads/campaigns/${c.id}`, method: "PATCH", body: { status: c.status === "ENABLED" ? "PAUSED" : "ENABLED" } })}
            >
              {c.status === "ENABLED" ? "Pause" : "Enable"}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => openAddNegatives({ campaignId: c.id, adGroupId: null })}>
              <MinusCircle aria-hidden className="size-3.5" />
              Negatives
            </Button>
            <Button variant="muted" size="sm" onClick={() => openCreateAdGroup(c.id)}>
              <Plus aria-hidden className="size-3.5" />
              Ad group
            </Button>
          </>
        )
      }
    >
      <ErrorNote error={error} />
      {isLoading && <LoadingRows />}
      {c && data && (
        <div className="flex flex-col gap-5 p-6">
          <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
            <Stat label="Status" value={<StatusTag status={c.status} display={c.displayStatus} />} hint={c.servingStateReasons.slice(0, 2).join(", ").replaceAll("_", " ").toLowerCase() || undefined} />
            <Stat
              label="Daily budget"
              value={
                c.dailyBudget != null ? (
                  <InlineMoney value={c.dailyBudget} currency={c.currency} label="daily budget" onCommit={(next) => request({ title: "Change daily budget", url: `/api/apple-ads/campaigns/${c.id}`, method: "PATCH", body: { dailyBudget: next } })} />
                ) : (
                  "—"
                )
              }
              hint={c.budgetUtilization != null ? `${pct(c.budgetUtilization, 0)} used per day` : undefined}
            />
            <Stat label="Spend" value={money(c.metrics.spend, c.currency)} />
            <Stat label="Installs" value={count(c.metrics.installs)} />
            <Stat label="CPA" value={money(c.metrics.cpa, c.currency)} />
            <Stat label="CPT" value={money(c.metrics.cpt, c.currency)} />
            <Stat label="TTR" value={pct(c.metrics.ttr)} />
            {c.attribution && <Stat label="ROAS" value={multiple(c.attribution.roas)} hint={`${money(c.attribution.revenue, "USD")} revenue`} />}
          </div>

          <section className="flex flex-col gap-3">
            <h3>Ad groups</h3>
            <div className="border-border overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>Ad group</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Search Match</TableHead>
                    <TableHead>Default bid</TableHead>
                    <TableHead className="text-right">Keywords</TableHead>
                    <TableHead className="text-right">Spend</TableHead>
                    <TableHead className="text-right">Impr.</TableHead>
                    <TableHead className="text-right">Taps</TableHead>
                    <TableHead className="text-right">Installs</TableHead>
                    <TableHead className="text-right">TTR</TableHead>
                    <TableHead className="text-right">CPT</TableHead>
                    <TableHead className="text-right">CPA</TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.adGroups.map((g) => (
                    <AdGroupRow key={g.id} g={g} currency={c.currency} campaignId={c.id} />
                  ))}
                  {!data.adGroups.length && (
                    <TableRow>
                      <TableCell colSpan={15} className="text-subtle py-6 text-center">
                        No ad groups yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h3>Campaign negative keywords</h3>
            {data.negatives.length ? (
              <div className="flex flex-wrap gap-1.5">
                {data.negatives.map((n) => (
                  <Tag key={n.id} tone="red" size="sm" className="caption-style">
                    {n.text} · {n.matchType.toLowerCase()}
                  </Tag>
                ))}
              </div>
            ) : (
              <p className="text-subtle">None. Campaign-level negatives apply to every ad group in this campaign.</p>
            )}
          </section>
        </div>
      )}
    </DetailSheet>
  );
}
