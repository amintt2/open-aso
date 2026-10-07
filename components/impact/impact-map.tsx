"use client";

import { useState } from "react";
import { Panel } from "@/components/analytics/chart-kit";
import WorldMap from "@/components/shell/world-map";
import type { ImpactResult } from "@/lib/impact/types";
import { cn } from "@/lib/utils";
import { countryName, flagOf, formatEstimate, formatEstimateUsd } from "./impact-format";

type Metric = "downloads" | "revenue";

export default function ImpactMap({ data, onSelect }: { data: ImpactResult; onSelect: (code: string) => void }) {
  const [metric, setMetric] = useState<Metric>("downloads");
  const active: Metric = data.revenueAvailable ? metric : "downloads";
  const values = Object.fromEntries(data.geography.map((g) => [g.country, active === "downloads" ? g.estDownloads : g.estRevenue]));
  const format = active === "downloads" ? formatEstimate : formatEstimateUsd;
  const ranked = [...data.geography].sort((a, b) => (active === "downloads" ? b.estDownloads - a.estDownloads : (b.estRevenue ?? 0) - (a.estRevenue ?? 0)));
  return (
    <Panel
      title="By country"
      description="Modelled installs and revenue from tracked keywords in each country you track. Select a country to focus on it."
      actions={
        data.revenueAvailable && (
          <div role="radiogroup" aria-label="Map metric" className="bg-secondary flex h-[30px] items-center rounded-full p-0.5 shadow-[0px_0px_0px_1px_rgba(0,0,0,0.4),inset_0px_1px_0px_0px_rgba(255,255,255,0.1)]">
            {(["downloads", "revenue"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={active === m}
                onClick={() => setMetric(m)}
                className={cn("caption-style ease-power3-out h-full cursor-pointer rounded-full px-3 capitalize transition-colors duration-150", active === m ? "bg-muted text-foreground" : "text-subtle hover:text-soft")}
              >
                {m}
              </button>
            ))}
          </div>
        )
      }
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <WorldMap values={values} format={format} selected={data.country === "all" ? null : data.country} onSelect={onSelect} legend={active === "downloads" ? "Est. installs from keywords" : "Est. revenue from keywords"} />
        <ul className="flex flex-col">
          {ranked.map((g) => (
            <li key={g.country}>
              <button
                type="button"
                onClick={() => onSelect(g.country)}
                className={cn("hover:bg-white/4 flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-2 text-left", data.country === g.country && "bg-white/6")}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span aria-hidden>{flagOf(g.country)}</span>
                  <span className="truncate">{countryName(g.country)}</span>
                </span>
                <span className="flex flex-col items-end gap-0.5 tabular-nums">
                  <span>~{format(active === "downloads" ? g.estDownloads : g.estRevenue)}</span>
                  {g.observed != null && <span className="caption-style text-subtle">of {formatEstimate(g.observed)} observed</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}
