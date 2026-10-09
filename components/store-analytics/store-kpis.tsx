"use client";

import { KpiTile } from "@/components/analytics/parts";
import type { StoreTotals } from "@/lib/asc/analytics/types";
import { formatCompact, formatPercent } from "@/lib/client/format";
import { DeltaText } from "./parts";

export default function StoreKpis({ totals, days }: { totals: StoreTotals; days: number }) {
  const suffix = `vs prior ${days}d`;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 min-[1600px]:grid-cols-6">
      <KpiTile
        label="First-time downloads"
        value={formatCompact(totals.firstDownloads.current)}
        hint="First downloads of the app by an Apple Account (Apple, App Downloads report)"
        delta={<DeltaText period={totals.firstDownloads} suffix={suffix} />}
      />
      <KpiTile label="Redownloads" value={formatCompact(totals.redownloads.current)} hint="Downloads by an Apple Account that downloaded the app before" delta={<DeltaText period={totals.redownloads} suffix={suffix} />} />
      <KpiTile
        label="Conversion rate"
        value={formatPercent(totals.conversion.current, 2)}
        hint="First-time downloads ÷ unique impressions. Unique counts are summed across devices and territories, so this is a close approximation."
        delta={<DeltaText period={totals.conversion} suffix={suffix} points />}
      />
      <KpiTile label="Impressions" value={formatCompact(totals.impressions.current)} hint="Times the app icon was shown in search results, charts, Today, Apps and Games" delta={<DeltaText period={totals.impressions} suffix={suffix} />} />
      <KpiTile
        label="Page views"
        value={formatCompact(totals.pageViews.current)}
        hint={`Product page and store sheet views. Page-view conversion: ${formatPercent(totals.pageViewConversion.current, 1)}`}
        delta={<DeltaText period={totals.pageViews} suffix={suffix} />}
      />
      <KpiTile label="Updates" value={formatCompact(totals.updates.current)} hint="Manual and automatic updates" delta={<DeltaText period={totals.updates} suffix={suffix} />} />
    </div>
  );
}
