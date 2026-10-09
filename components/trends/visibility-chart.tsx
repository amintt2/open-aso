"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS_TICK, ChartTooltip, GRID, Panel, shortDate } from "@/components/analytics/chart-kit";
import type { TrendPoint, TrendVersion } from "@/lib/trends/types";
import { cn } from "@/lib/utils";
import { formatInstalls, VISIBILITY_COLOR } from "./trends-format";

type Mode = "visibility" | "installs";

const MODES: { key: Mode; label: string }[] = [
  { key: "visibility", label: "Score" },
  { key: "installs", label: "Installs/day" },
];

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

export default function VisibilityChart({ points, versions, days }: { points: TrendPoint[]; versions: TrendVersion[]; days: number }) {
  const [mode, setMode] = useState<Mode>("visibility");
  const byDate = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const v of versions) map.set(v.date, [...(map.get(v.date) ?? []), v.version]);
    return map;
  }, [versions]);
  const data = useMemo(() => points.map((p) => ({ ...p, visibility: p.tracked ? p.visibility : null, installs: p.tracked ? p.installs : null })), [points]);
  const gradient = `trend-visibility-${mode}`;

  return (
    <Panel
      title="Visibility over time"
      description={
        mode === "visibility"
          ? "Share of the search installs you'd get ranking #1 for every tracked keyword (0–100). Modelled estimate."
          : "Estimated daily installs from search across tracked keywords. Modelled estimate."
      }
      actions={<Segmented label="Visibility metric" value={mode} options={MODES} onChange={setMode} />}
    >
      <div className="h-[260px]" role="img" aria-label={`Visibility ${mode === "visibility" ? "score" : "installs"} over the last ${days} days`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 16, right: 8, bottom: 0, left: -12 }}>
            <defs>
              <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={VISIBILITY_COLOR} stopOpacity={0.35} />
                <stop offset="100%" stopColor={VISIBILITY_COLOR} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS_TICK} axisLine={false} tickLine={false} interval={tickInterval(days)} />
            <YAxis
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
              width={44}
              domain={mode === "visibility" ? [0, (max: number) => Math.min(100, Math.max(5, Math.ceil(max / 5) * 5))] : [0, "auto"]}
              tickFormatter={(v: number) => (mode === "visibility" ? String(v) : formatInstalls(v))}
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
                      { label: "Visibility score", value: p.visibility == null ? "—" : p.visibility.toFixed(1), color: mode === "visibility" ? VISIBILITY_COLOR : undefined },
                      { label: "Est. installs/day", value: `~${formatInstalls(p.installs)}`, color: mode === "installs" ? VISIBILITY_COLOR : undefined },
                      { label: "Keywords", value: String(p.tracked) },
                      ...(byDate.has(p.date) ? [{ label: "Released", value: (byDate.get(p.date) ?? []).map((v) => `v${v}`).join(", ") }] : []),
                    ];
                  }}
                />
              )}
            />
            <Area type="monotone" dataKey={mode} stroke={VISIBILITY_COLOR} strokeWidth={2} fill={`url(#${gradient})`} connectNulls={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {versions.length > 0 && (
        <p className="caption-style text-subtle">
          Releases: {versions.map((v) => `v${v.version} (${shortDate(v.date)})`).join(" · ")}
        </p>
      )}
    </Panel>
  );
}
