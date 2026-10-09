"use client";

import { Panel } from "@/components/analytics/chart-kit";
import type { TrendCountry } from "@/lib/trends/types";
import { cn } from "@/lib/utils";
import { countryName, flagOf, formatInstalls } from "./trends-format";

export default function CountryBreakdown({ countries, onSelect }: { countries: TrendCountry[]; onSelect: (code: string) => void }) {
  return (
    <Panel title="Visibility by country" description="Visibility score and estimated daily search installs per storefront. Click a country to focus on it.">
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {countries.map((c) => {
          const change = c.visibility != null && c.visibilityStart != null ? Math.round((c.visibility - c.visibilityStart) * 10) / 10 : null;
          return (
            <li key={c.country}>
              <button
                type="button"
                onClick={() => onSelect(c.country)}
                className="border-border focus-visible:ring-ring/60 flex w-full cursor-pointer flex-col gap-2 rounded-lg border px-3 py-2.5 text-left outline-none hover:bg-white/4 focus-visible:ring-2"
              >
                <span className="flex items-center gap-1.5 text-[14px]">
                  <span aria-hidden>{flagOf(c.country)}</span>
                  <span className="truncate">{countryName(c.country)}</span>
                  <span className="caption-style text-subtle ml-auto shrink-0">
                    {c.keywords} {c.keywords === 1 ? "keyword" : "keywords"}
                  </span>
                </span>
                <span className="flex items-baseline gap-2 tabular-nums">
                  <span className="text-[18px] leading-none font-medium">{c.visibility == null ? "—" : c.visibility.toFixed(1)}</span>
                  {change != null && change !== 0 && (
                    <span className={cn("caption-style", change > 0 ? "text-trend" : "text-danger")}>
                      {change > 0 ? "▲" : "▼"} {Math.abs(change).toFixed(1)}
                    </span>
                  )}
                  <span className="caption-style text-subtle ml-auto">~{formatInstalls(c.installs)}/day</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
