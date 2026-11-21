"use client";

import { Panel } from "@/components/analytics/chart-kit";
import type { TrendCountry } from "@/lib/trends/types";
import { cn } from "@/lib/utils";
import { approxInstalls, countryName, flagOf, formatInstalls, formatPosition, formatReach } from "./trends-format";

export default function CountryBreakdown({ countries, onSelect }: { countries: TrendCountry[]; onSelect: (code: string) => void }) {
  return (
    <Panel title="Search installs by country" description="Estimated daily search installs, keywords in the top 10 and best keyword per storefront. Click a country to focus on it.">
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {countries.map((c) => {
          const change = Math.round((c.installs - c.installsStart) * 10) / 10;
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
                  <span className="text-[18px] leading-none font-medium">{approxInstalls(c.installs)}</span>
                  <span className="caption-style text-subtle">/day</span>
                  {change !== 0 && (
                    <span className={cn("caption-style", change > 0 ? "text-trend" : "text-danger")}>
                      {change > 0 ? "▲" : "▼"} {formatInstalls(Math.abs(change))}
                    </span>
                  )}
                  <span className="caption-style text-subtle ml-auto" title="Search reach: share of the installs available on the keywords in your metadata">
                    reach {formatReach(c.reach)}
                  </span>
                </span>
                <span className="caption-style text-subtle flex min-w-0 items-center gap-1.5">
                  <span className="shrink-0 tabular-nums">{c.top10} in top 10</span>
                  {c.bestKeyword && (
                    <span className="min-w-0 truncate" title={`Best keyword: ${c.bestKeyword.term}`}>
                      · best {c.bestKeyword.term} {formatPosition(c.bestKeyword.position)}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
