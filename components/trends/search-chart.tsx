"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS_TICK, ChartTooltip, GRID, Panel, shortDate } from "@/components/analytics/chart-kit";
import type { TrendContributor, TrendPoint, TrendVersion } from "@/lib/trends/types";
import { cn } from "@/lib/utils";
import { approxInstalls, flagOf, formatInstalls, formatPosition, formatReach, REACH_HINT, SEARCH_COLOR } from "./trends-format";

type Mode = "installs" | "reach";

const MODES: { key: Mode; label: string }[] = [
  { key: "installs", label: "Installs/day" },
  { key: "reach", label: "Top-10 share %" },
];

const MOVED_LIMIT = 5;

export function tickInterval(days: number) {
  return days > 90 ? 44 : days > 30 ? 13 : days > 7 ? 4 : 0;
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { key: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="bg-secondary flex h-[30px] items-center rounded-full p-0.5 shadow-[0px_0px_0px_1px_rgba(0,0,0,0.4),inset_0px_1px_0px_0px_rgba(255,255,255,0.1)]">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          role="radio"
          aria-checked={value === o.key}
          onClick={() => onChange(o.key)}
          className={cn(
            "caption-style ease-power3-out focus-visible:ring-ring/60 h-full cursor-pointer rounded-full px-3 transition-colors duration-150 outline-none focus-visible:ring-2",
            value === o.key ? "bg-muted text-foreground" : "text-subtle hover:text-soft",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function WhatMoved({ contributors, appId, since, onOpen }: { contributors: TrendContributor[]; appId: number; since: string | null; onOpen?: (id: number) => void }) {
  const rows = contributors.slice(0, MOVED_LIMIT);
  const row = "focus-visible:ring-ring/60 grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-3 rounded-md px-2 py-1.5 text-left outline-none hover:bg-white/4 focus-visible:ring-2";
  return (
    <div className="border-border flex flex-col gap-1.5 border-t pt-3">
      <span className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="eyebrow-style text-subtle">What moved it</span>
        <span className="caption-style text-subtle">{since ? `Keywords whose estimated installs changed most since ${shortDate(since)}` : "Needs at least two days of rankings"}</span>
      </span>
      {rows.length ? (
        <ul className="-mx-2 flex flex-col">
          {rows.map((c) => {
            const cells = (
              <>
                <span className="flex min-w-0 items-center gap-1.5 text-[14px]">
                  <span aria-hidden>{flagOf(c.country)}</span>
                  <span className="truncate">{c.term}</span>
                  {!c.target && (
                    <span className="caption-style text-subtle shrink-0" title="Not in your title, subtitle or keyword field, so it does not count in the top-10 share">
                      not in metadata
                    </span>
                  )}
                </span>
                <span className="caption-style text-soft tabular-nums" title="Position at the start of the period, then today">
                  {formatPosition(c.startPosition)} → {formatPosition(c.endPosition)}
                </span>
                <span className="caption-style text-subtle w-12 text-right tabular-nums" title="Search popularity today, 0 to 100">
                  pop {c.popularity == null ? "—" : Math.round(c.popularity)}
                </span>
                <span className={cn("caption-style w-16 text-right tabular-nums", c.installsChange > 0 ? "text-trend" : "text-danger")} title="Change in estimated search installs per day">
                  {c.installsChange > 0 ? "+" : "−"}
                  {formatInstalls(Math.abs(c.installsChange))}/day
                </span>
              </>
            );
            return (
              <li key={c.id}>
                {onOpen ? (
                  <button type="button" onClick={() => onOpen(c.id)} className={row}>
                    {cells}
                  </button>
                ) : (
                  <Link href={`/apps/${appId}/keywords?q=${encodeURIComponent(c.term)}`} className={row}>
                    {cells}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="caption-style text-subtle py-2">{since ? "No keyword changed position or popularity enough to move the estimate." : "The list fills in once rankings have been checked on two different days."}</p>
      )}
    </div>
  );
}

export default function SearchChart({
  points,
  versions,
  days,
  contributors,
  appId,
  onOpen,
}: {
  points: TrendPoint[];
  versions: TrendVersion[];
  days: number;
  contributors: TrendContributor[];
  appId: number;
  onOpen?: (id: number) => void;
}) {
  const [mode, setMode] = useState<Mode>("installs");
  const byDate = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const v of versions) map.set(v.date, [...(map.get(v.date) ?? []), v.version]);
    return map;
  }, [versions]);
  const data = useMemo(() => points.map((p) => ({ ...p, reach: p.tracked ? p.reach : null, installs: p.tracked ? p.installs : null })), [points]);
  const first = points.find((p) => p.tracked > 0);
  const last = points[points.length - 1];
  const since = first && last && first.date !== last.date ? first.date : null;
  const gradient = `trend-search-${mode}`;

  return (
    <Panel
      title="Estimated search installs"
      description={
        mode === "installs"
          ? "Installs per day the model expects from your current ranks: searches per day × a tap share that decays with position down to #200 × 40% install rate, scaled so the total matches the downloads Apple attributes to App Store search over the last 14 days. Estimate, not Apple data."
          : REACH_HINT
      }
      actions={<Segmented label="Search metric" value={mode} options={MODES} onChange={setMode} />}
    >
      <div className="h-[220px]" role="img" aria-label={`${mode === "installs" ? "Estimated search installs per day" : "Top-10 share"} over the last ${days} days`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 16, right: 8, bottom: 0, left: -12 }}>
            <defs>
              <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SEARCH_COLOR} stopOpacity={0.35} />
                <stop offset="100%" stopColor={SEARCH_COLOR} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS_TICK} axisLine={false} tickLine={false} interval={tickInterval(days)} />
            <YAxis
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
              width={44}
              domain={mode === "reach" ? [0, (max: number) => Math.min(100, Math.max(5, Math.ceil(max / 5) * 5))] : [0, "auto"]}
              tickFormatter={(v: number) => (mode === "reach" ? `${v}%` : formatInstalls(v))}
            />
            {versions.map((v) => (
              <ReferenceLine
                key={v.version}
                x={v.date}
                stroke="var(--faint)"
                strokeDasharray="3 3"
                label={versions.length <= 6 && days <= 90 ? { value: `v${v.version}`, position: "insideTopRight", fill: "var(--subtle)", fontSize: 10 } : undefined}
              />
            ))}
            <Tooltip
              cursor={{ stroke: "rgba(255,255,255,0.2)" }}
              content={(props) => (
                <ChartTooltip
                  {...props}
                  rows={(pt) => {
                    const p = pt as unknown as TrendPoint;
                    if (!p.tracked) return [{ label: "No data yet", value: "" }];
                    return [
                      { label: "Est. search installs/day", value: approxInstalls(p.installs), color: mode === "installs" ? SEARCH_COLOR : undefined },
                      { label: "Top-10 share", value: formatReach(p.reach), color: mode === "reach" ? SEARCH_COLOR : undefined },
                      { label: "Keywords in top 10", value: String(p.top3 + p.top10) },
                      { label: "Keywords in metadata", value: `${p.targets} of ${p.tracked}` },
                      ...(byDate.has(p.date) ? [{ label: "Released", value: (byDate.get(p.date) ?? []).map((v) => `v${v}`).join(", ") }] : []),
                    ];
                  }}
                />
              )}
            />
            <Area type="monotone" dataKey={mode} stroke={SEARCH_COLOR} strokeWidth={2} fill={`url(#${gradient})`} connectNulls={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {versions.length > 0 && (
        <p className="caption-style text-subtle">
          Releases: {versions.map((v) => `v${v.version} (${shortDate(v.date)})`).join(" · ")}
        </p>
      )}
      <WhatMoved contributors={contributors} appId={appId} since={since} onOpen={onOpen} />
    </Panel>
  );
}
