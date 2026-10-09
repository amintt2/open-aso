"use client";

import { KpiTile } from "@/components/analytics/parts";
import { shortDate } from "@/components/analytics/chart-kit";
import type { TrendKpis } from "@/lib/trends/types";
import { cn } from "@/lib/utils";
import { formatInstalls } from "./trends-format";

type Change = { value: number | null; good: boolean | null; text: string };

function DeltaLine({ change, since }: { change: Change; since: string | null }) {
  if (change.value == null || !since)
    return <span className="caption-style text-subtle truncate">No earlier data in this period</span>;
  return (
    <span className="caption-style truncate tabular-nums">
      <span className={cn(change.value === 0 ? "text-subtle" : change.good ? "text-trend" : "text-danger")}>
        {change.value > 0 ? "▲" : change.value < 0 ? "▼" : "="} {change.text}
      </span>
      <span className="text-subtle"> since {shortDate(since)}</span>
    </span>
  );
}

function diff(end: number | null | undefined, start: number | null | undefined, digits = 0) {
  if (end == null || start == null) return null;
  const f = 10 ** digits;
  return Math.round((end - start) * f) / f;
}

function points(value: number | null, unit: string, digits = 0): Change {
  const abs = Math.abs(value ?? 0).toFixed(digits);
  return { value, good: value == null ? null : value > 0, text: unit ? `${abs} ${unit}` : abs };
}

export default function TrendsKpis({ start, end }: { start: TrendKpis | null; end: TrendKpis | null }) {
  const since = start && end && start.date !== end.date ? start.date : null;
  const installChange = diff(end?.installs, start?.installs, 3);
  const installPct = start?.installs && end ? (end.installs - start.installs) / start.installs : null;
  const avgChange = diff(end?.avgPosition, start?.avgPosition, 1);
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      <KpiTile
        label="Visibility score"
        hint="Estimated search installs as a share of what you'd get ranking #1 for every keyword (0–100)"
        value={end?.visibility == null ? "—" : end.visibility.toFixed(1)}
        delta={<DeltaLine since={since} change={points(diff(end?.visibility, start?.visibility, 1), "pts", 1)} />}
      />
      <KpiTile
        label="Est. installs/day"
        hint="Modelled daily installs from search: searches per day × tap share at your position × 40% install rate"
        value={end ? `~${formatInstalls(end.installs)}` : "—"}
        delta={
          <DeltaLine
            since={since}
            change={{
              value: installChange,
              good: installChange == null ? null : installChange > 0,
              text: installPct == null ? formatInstalls(Math.abs(installChange ?? 0)) : `${Math.abs(installPct * 100).toFixed(1)}%`,
            }}
          />
        }
      />
      <KpiTile
        label="Avg. position"
        hint="Average position of keywords ranked in the top 200"
        value={end?.avgPosition == null ? "—" : `#${end.avgPosition.toFixed(1)}`}
        delta={<DeltaLine since={since} change={{ value: avgChange, good: avgChange == null ? null : avgChange < 0, text: `${Math.abs(avgChange ?? 0).toFixed(1)} pos.` }} />}
      />
      <KpiTile
        label="In top 10"
        hint="Keywords ranked #1–#10"
        value={end ? `${end.top10}${end.tracked ? ` / ${end.tracked}` : ""}` : "—"}
        delta={<DeltaLine since={since} change={points(diff(end?.top10, start?.top10), "")} />}
      />
      <KpiTile
        label="In top 3"
        hint="Keywords ranked #1–#3"
        value={end ? String(end.top3) : "—"}
        delta={<DeltaLine since={since} change={points(diff(end?.top3, start?.top3), "")} />}
      />
    </div>
  );
}
