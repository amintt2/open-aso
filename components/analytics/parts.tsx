"use client";

import { FlaskConical, Loader2, TriangleAlert } from "lucide-react";
import Button from "@/components/_ui/button";
import Tag from "@/components/_ui/tag";
import { cn } from "@/lib/utils";

export function DemoBanner({ notice }: { notice: string | null }) {
  if (!notice) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-(--tag-amber-border) bg-(--tag-amber-bg) px-4 py-3">
      <span className="flex items-center gap-2 text-(--tag-amber-text)">
        <FlaskConical aria-hidden className="size-4 shrink-0" />
        <p>{notice}</p>
      </span>
      <Button variant="secondary" size="sm" href="/integrations">
        Set up integrations
      </Button>
    </div>
  );
}

export function LoadingBlock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "text-subtle flex min-h-[240px] items-center justify-center",
        className,
      )}
    >
      <Loader2 aria-label="Loading" className="size-5 animate-spin" />
    </div>
  );
}

export function ErrorBlock({ message }: { message: string }) {
  return (
    <div className="text-danger flex min-h-[200px] items-center justify-center gap-2">
      <TriangleAlert aria-hidden className="size-4" />
      <p>{message}</p>
    </div>
  );
}

export function Delta({
  current,
  previous,
  invert = false,
}: {
  current: number;
  previous: number;
  invert?: boolean;
}) {
  if (!previous)
    return <span className="caption-style text-subtle">no prior data</span>;
  const change = (current - previous) / Math.abs(previous);
  if (!Number.isFinite(change)) return null;
  const good = invert ? change < 0 : change > 0;
  return (
    <span
      className={cn(
        "caption-style tabular-nums",
        Math.abs(change) < 0.005
          ? "text-subtle"
          : good
            ? "text-trend"
            : "text-danger",
      )}
    >
      {change > 0 ? "▲" : change < 0 ? "▼" : ""}{" "}
      {Math.abs(change * 100).toFixed(1)}%
      <span className="text-subtle"> vs prior</span>
    </span>
  );
}

export type KpiSource =
  | "apple"
  | "posthog"
  | "measured"
  | "estimate"
  | "revenue"
  | "ads"
  | "sdk";

const KPI_SOURCE: Record<
  KpiSource,
  { label: string; title: string; className: string }
> = {
  apple: {
    label: "Apple",
    title: "Reported by Apple in App Store Connect Analytics. The reference for impressions and downloads.",
    className: "text-trend",
  },
  posthog: {
    label: "PostHog",
    title: "Counted from the events your app sends to PostHog. Can include test and App Review devices, so it runs higher than Apple's downloads.",
    className: "text-soft",
  },
  measured: {
    label: "Measured",
    title: "Observed by Open ASO's daily App Store search checks for your tracked keywords.",
    className: "text-soft",
  },
  estimate: {
    label: "Estimate",
    title: "Modeled by Open ASO from popularity and rank. Not observed: use it for direction, not as a count.",
    className: "text-warning",
  },
  revenue: {
    label: "Reported",
    title: "Reported by your revenue provider (RevenueCat or Superwall webhooks).",
    className: "text-soft",
  },
  ads: {
    label: "Apple Ads",
    title: "Reported by the Apple Ads API.",
    className: "text-trend",
  },
  sdk: {
    label: "SDK",
    title: "Reported by the Open ASO SDK installed in your app.",
    className: "text-soft",
  },
};

export function KpiTile({
  label,
  value,
  delta,
  hint,
  source,
}: {
  label: string;
  value: string;
  delta?: React.ReactNode;
  hint?: string;
  source?: KpiSource;
}) {
  const meta = source ? KPI_SOURCE[source] : null;
  return (
    <div
      className="bg-card border-border flex min-w-0 flex-col gap-3 rounded-xl border p-4"
      title={hint}
    >
      <span className="flex min-w-0 items-center justify-between gap-2">
        <span className="eyebrow-style text-subtle truncate">{label}</span>
        {meta && (
          <span
            className={cn("caption-style shrink-0", meta.className)}
            title={meta.title}
          >
            {meta.label}
          </span>
        )}
      </span>
      <span className="text-[24px] leading-none font-medium tracking-tight tabular-nums">
        {value}
      </span>
      {delta}
    </div>
  );
}

export function MetricBar({
  value,
  max,
  color,
}: {
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <span className="bg-track/60 block h-1.5 w-full min-w-16 overflow-hidden rounded-full">
      <span
        className="block h-full rounded-full"
        style={{ width: `${pct}%`, background: color }}
      />
    </span>
  );
}

export function RoasTag({ roas }: { roas: number | null }) {
  if (roas == null) return <span className="text-subtle">—</span>;
  const tone = roas >= 1 ? "green" : roas >= 0.5 ? "amber" : "red";
  return (
    <Tag tone={tone} size="sm" className="text-[12px] tabular-nums">
      {roas.toFixed(2)}×
    </Tag>
  );
}
