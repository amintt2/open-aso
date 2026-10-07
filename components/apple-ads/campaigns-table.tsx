"use client";

import { ChevronRight } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import type { AdsCampaign } from "@/lib/apple-ads/types";
import { cn } from "@/lib/utils";
import { InlineMoney, StatusTag, StatusToggle } from "./bits";
import { useRequestChange } from "./change-provider";
import { count, countryLabel, money, multiple, pct } from "./format";
import { useAdsUi } from "./store";

export default function CampaignsTable({ campaigns, currency }: { campaigns: AdsCampaign[]; currency: string }) {
  const request = useRequestChange();
  const openCampaign = useAdsUi((s) => s.openCampaign);
  const hasRoas = campaigns.some((c) => c.attribution);

  return (
    <div className="bg-card border-border overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10" />
            <TableHead>Campaign</TableHead>
            <TableHead>Country</TableHead>
            <TableHead>Daily budget</TableHead>
            <TableHead className="text-right">Spend</TableHead>
            <TableHead className="text-right">Impr.</TableHead>
            <TableHead className="text-right">Taps</TableHead>
            <TableHead className="text-right">TTR</TableHead>
            <TableHead className="text-right">Installs</TableHead>
            <TableHead className="text-right">CR</TableHead>
            <TableHead className="text-right">CPT</TableHead>
            <TableHead className="text-right">CPA</TableHead>
            {hasRoas && <TableHead className="text-right">ROAS</TableHead>}
            <TableHead className="w-8" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {campaigns.map((c) => (
            <TableRow key={c.id} className="hover:bg-white/2">
              <TableCell className="pr-0">
                <StatusToggle
                  active={c.status === "ENABLED"}
                  label={c.name}
                  onToggle={() =>
                    request({
                      title: `${c.status === "ENABLED" ? "Pause" : "Enable"} campaign`,
                      url: `/api/apple-ads/campaigns/${c.id}`,
                      method: "PATCH",
                      body: { status: c.status === "ENABLED" ? "PAUSED" : "ENABLED" },
                      success: `Campaign ${c.status === "ENABLED" ? "paused" : "enabled"}`,
                    })
                  }
                />
              </TableCell>
              <TableCell className="max-w-[320px]">
                <button type="button" onClick={() => openCampaign(c.id)} className="flex max-w-full cursor-pointer items-center gap-2 text-left hover:underline">
                  <span className="truncate">{c.name}</span>
                  <StatusTag status={c.status} display={c.displayStatus} />
                </button>
              </TableCell>
              <TableCell>{c.countries.length > 1 ? `${c.countries.length} countries` : countryLabel(c.countries[0])}</TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  {c.dailyBudget != null ? (
                    <InlineMoney
                      value={c.dailyBudget}
                      currency={c.currency}
                      label={`daily budget of ${c.name}`}
                      onCommit={(next) => request({ title: "Change daily budget", url: `/api/apple-ads/campaigns/${c.id}`, method: "PATCH", body: { dailyBudget: next }, success: "Budget updated" })}
                    />
                  ) : (
                    <span className="text-subtle">—</span>
                  )}
                  {c.budgetUtilization != null && c.status === "ENABLED" && (
                    <span className="bg-track h-1 w-20 overflow-hidden rounded-full" title={`${pct(c.budgetUtilization, 0)} of daily budget used on average`}>
                      <span className={cn("block h-full rounded-full", c.budgetUtilization >= 0.9 ? "bg-warning" : "bg-[#3987e5]")} style={{ width: `${Math.min(100, Math.max(4, c.budgetUtilization * 100))}%` }} />
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right tabular-nums">{money(c.metrics.spend, currency)}</TableCell>
              <TableCell className="text-right tabular-nums">{count(c.metrics.impressions)}</TableCell>
              <TableCell className="text-right tabular-nums">{count(c.metrics.taps)}</TableCell>
              <TableCell className="text-right tabular-nums">{pct(c.metrics.ttr)}</TableCell>
              <TableCell className="text-right tabular-nums">{count(c.metrics.installs)}</TableCell>
              <TableCell className="text-right tabular-nums">{pct(c.metrics.cr)}</TableCell>
              <TableCell className="text-right tabular-nums">{money(c.metrics.cpt, currency)}</TableCell>
              <TableCell className="text-right tabular-nums">{money(c.metrics.cpa, currency)}</TableCell>
              {hasRoas && <TableCell className="text-right tabular-nums">{multiple(c.attribution?.roas)}</TableCell>}
              <TableCell className="pl-0">
                <button type="button" aria-label={`Open ${c.name}`} onClick={() => openCampaign(c.id)} className="text-subtle hover:text-foreground cursor-pointer">
                  <ChevronRight aria-hidden className="size-4" />
                </button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
