"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { KpiTile } from "@/components/analytics/parts";
import { ConnectTile, TileSkeletons } from "@/components/dashboard/kpi-tiles";
import { PctDelta } from "@/components/dashboard/parts";
import { DemoTag, WidgetError } from "@/components/dashboard/widget";
import type { StoreSummary } from "@/lib/asc/analytics/types";
import { useApi } from "@/lib/client/api";
import { formatCompact, formatPercent } from "@/lib/client/format";
import { formatDay } from "./format";
import { DeltaText } from "./parts";

const LABELS = ["First-time downloads · 7d", "Impressions · 7d", "Page views · 7d", "Conversion rate · 7d"];

function Tiles({ data, href }: { data: StoreSummary; href: string }) {
  if (data.state !== "ok")
    return (
      <>
        {LABELS.map((label) => (
          <ConnectTile key={label} label={label} hint={data.state === "not_connected" ? "Connect App Store Connect" : "Waiting for Apple's first report"} href={href} />
        ))}
      </>
    );
  return (
    <>
      <KpiTile
        source="apple"
        label={LABELS[0]}
        value={formatCompact(data.firstDownloads?.current)}
        hint="People who downloaded the app for the first time in the last 7 days of Apple data. The reference number for new installs."
        delta={<PctDelta period={data.firstDownloads} />}
      />
      <KpiTile
        source="apple"
        label={LABELS[1]}
        value={formatCompact(data.impressions?.current)}
        hint="Times your app icon was shown on the App Store (search results, charts, Today, product page) in the last 7 days of Apple data."
        delta={<PctDelta period={data.impressions} />}
      />
      <KpiTile
        source="apple"
        label={LABELS[2]}
        value={formatCompact(data.pageViews?.current)}
        hint="Times your product page was opened in the last 7 days of Apple data."
        delta={<PctDelta period={data.pageViews} />}
      />
      <KpiTile
        source="apple"
        label={LABELS[3]}
        value={formatPercent(data.conversion?.current ?? null, 2)}
        hint="First-time downloads divided by unique impressions over the same 7 days: how many people who saw the app installed it."
        delta={<DeltaText period={data.conversion} suffix="vs prior 7d" points />}
      />
    </>
  );
}

export default function StoreRow({ appId, onlyWithData = false }: { appId?: number; onlyWithData?: boolean }) {
  const { data, error } = useApi<StoreSummary>(`/api/store-analytics/summary${appId ? `?appId=${appId}` : ""}`);
  if (onlyWithData && (!data || data.state !== "ok")) return null;
  const href = appId ? `/apps/${appId}/store-analytics` : "/integrations";
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="eyebrow-style text-subtle">App Store traffic · reported by Apple</h2>
        {data?.demo && <DemoTag title="Sample data imported from fixtures" />}
        {data?.dataThrough && (
          <span className="caption-style text-subtle" title="Apple publishes analytics with a delay of one to three days">
            Last 7 days of Apple data, through {formatDay(data.dataThrough)}
          </span>
        )}
        {appId && data?.state === "ok" && (
          <Link href={href} className="caption-style text-soft hover:text-foreground ml-auto inline-flex items-center gap-1 transition-colors duration-150">
            Details
            <ArrowRight aria-hidden className="size-3" />
          </Link>
        )}
      </div>
      {error && !data ? (
        <WidgetError message={error.message} />
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{data ? <Tiles data={data} href={href} /> : <TileSkeletons count={4} />}</div>
      )}
    </div>
  );
}
