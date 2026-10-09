"use client";

import { CircleAlert, Clock3, FlaskConical, Hourglass } from "lucide-react";
import Button from "@/components/_ui/button";
import type { StoreAnalyticsResult } from "@/lib/asc/analytics/types";
import { formatDay, formatUtcMinute, formatWhen } from "./format";

function Banner({ tone, icon: Icon, title, detail, action }: { tone: "amber" | "red" | "neutral"; icon: typeof Clock3; title: string; detail?: string | null; action?: React.ReactNode }) {
  const styles =
    tone === "amber"
      ? "border-(--tag-amber-border) bg-(--tag-amber-bg) text-(--tag-amber-text)"
      : tone === "red"
        ? "border-(--tag-red-border) bg-(--tag-red-bg) text-(--tag-red-text)"
        : "border-border bg-card text-soft";
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${styles}`}>
      <span className="flex min-w-0 flex-1 items-start gap-2">
        <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span className="flex min-w-0 flex-col gap-1">
          <p className="break-words">{title}</p>
          {detail && <span className="caption-style text-subtle break-words">{detail}</span>}
        </span>
      </span>
      {action}
    </div>
  );
}

export function nextCheckText(data: StoreAnalyticsResult) {
  return data.sync.nextCheckAt ? `Next check ~${formatWhen(data.sync.nextCheckAt)}.` : "";
}

export function FreshnessLine({ data }: { data: StoreAnalyticsResult }) {
  const s = data.sync;
  const usual = formatUtcMinute(s.publishMinuteUtc);
  return (
    <p className="caption-style text-subtle flex flex-wrap items-center gap-x-1.5 gap-y-1">
      <Clock3 aria-hidden className="size-3.5 shrink-0" />
      <span>Apple publishes yesterday&apos;s numbers once a day (usually early afternoon in Europe).</span>
      <span className="text-soft">Data through {formatDay(data.dataThrough)}.</span>
      {s.upToDate && <span>Up to date.</span>}
      {s.nextCheckAt && <span>{nextCheckText(data)}</span>}
      {usual && <span>Usually lands around {usual} for this app.</span>}
      {s.snapshot === "pending" && <span>Loading history from the one-time snapshot…</span>}
    </p>
  );
}

export default function StatusBanner({ data, onSync, onSample, syncing }: { data: StoreAnalyticsResult; onSync: () => void; onSample?: () => void; syncing: boolean }) {
  if (data.status === "waiting")
    return (
      <Banner
        tone="neutral"
        icon={Hourglass}
        title={`Analytics reports requested${data.sync.requestedAt ? ` on ${formatDay(data.sync.requestedAt)}` : ""}. Waiting for Apple to generate the first report.`}
        detail={`Apple usually needs 24–48 hours for the first report, then publishes yesterday's numbers once a day. ${nextCheckText(data)}`}
        action={
          <Button variant="secondary" size="sm" onClick={onSync} disabled={syncing}>
            Check now
          </Button>
        }
      />
    );
  if (data.status === "not_requested")
    return (
      <Banner
        tone="neutral"
        icon={Clock3}
        title="App Store Connect is linked, but analytics reports haven't been requested yet."
        detail="Requesting creates an ongoing daily report plus a one-time historical snapshot in App Store Connect (Admin API key required)."
        action={
          <Button variant="primary" size="sm" onClick={onSync} disabled={syncing}>
            Request reports
          </Button>
        }
      />
    );
  if (data.status === "error")
    return (
      <Banner
        tone="red"
        icon={CircleAlert}
        title="App Store Analytics couldn't be synced"
        detail={data.message}
        action={
          <span className="flex gap-2">
            {onSample && (
              <Button variant="secondary" size="sm" onClick={onSample}>
                Preview sample data
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={onSync} disabled={syncing}>
              Retry
            </Button>
          </span>
        }
      />
    );
  if (data.demo && data.notice) return <Banner tone="amber" icon={FlaskConical} title={data.notice} />;
  if (data.message) return <Banner tone="red" icon={CircleAlert} title="Last sync failed. Showing the data already imported." detail={data.message} />;
  return null;
}
