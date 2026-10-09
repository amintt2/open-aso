"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { Panel, shortDate } from "@/components/analytics/chart-kit";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/_ui/select";
import { UNRANKED, type TrendKeyword } from "@/lib/trends/types";
import { cn } from "@/lib/utils";
import { flagOf, formatPosition, latest, positionChangeOf, UNRANKED_LABEL } from "./trends-format";
import { Segmented } from "./visibility-chart";

type HeatMetric = "position" | "popularity" | "difficulty" | "delta";
type SortKey = "popularity" | "change" | "term";

const METRICS: { key: HeatMetric; label: string }[] = [
  { key: "position", label: "Position" },
  { key: "popularity", label: "Popularity" },
  { key: "difficulty", label: "Difficulty" },
  { key: "delta", label: "Δ Position" },
];

const SORTS: { key: SortKey; label: string }[] = [
  { key: "popularity", label: "Popularity" },
  { key: "change", label: "Position change" },
  { key: "term", label: "Keyword" },
];

const LOG_MAX = Math.log(UNRANKED);
const NO_DATA = "rgba(255,255,255,0.025)";

function cellWidth(days: number) {
  return days <= 7 ? 44 : days <= 30 ? 22 : days <= 90 ? 12 : 6;
}

function labelEvery(days: number) {
  return days <= 7 ? 1 : days <= 30 ? 3 : days <= 90 ? 10 : 45;
}

function deltaAt(k: TrendKeyword, i: number) {
  if (k.since == null || i <= k.since) return k.since === i ? 0 : null;
  return (k.position[i - 1] ?? UNRANKED) - (k.position[i] ?? UNRANKED);
}

function colorOf(metric: HeatMetric, k: TrendKeyword, i: number) {
  if (k.since == null || i < k.since) return NO_DATA;
  if (metric === "position") {
    const p = k.position[i];
    if (p == null) return "#262626";
    return `rgba(22,200,158,${(0.12 + 0.88 * (1 - Math.log(p) / LOG_MAX)).toFixed(3)})`;
  }
  if (metric === "delta") {
    const d = deltaAt(k, i) ?? 0;
    if (!d) return "#262626";
    const a = (0.25 + 0.75 * Math.min(1, Math.abs(d) / 20)).toFixed(3);
    return d > 0 ? `rgba(0,181,98,${a})` : `rgba(249,115,115,${a})`;
  }
  const v = k[metric][i];
  if (v == null) return "#262626";
  const a = (0.08 + 0.92 * (v / 100)).toFixed(3);
  return metric === "popularity" ? `rgba(57,135,229,${a})` : `rgba(217,89,38,${a})`;
}

function cellText(metric: HeatMetric, k: TrendKeyword, i: number) {
  if (k.since == null || i < k.since) return "";
  if (metric === "position") return k.position[i] == null ? "–" : String(k.position[i]);
  if (metric === "delta") {
    const d = deltaAt(k, i);
    return d ? (d > 0 ? `+${d}` : String(d)) : "";
  }
  const v = k[metric][i];
  return v == null ? "" : String(Math.round(v));
}

function deltaText(d: number | null) {
  return d == null || d === 0 ? "—" : d > 0 ? `▲ ${d}` : `▼ ${-d}`;
}

type Hover = { x: number; y: number; row: number; col: number };

function ScaleLegend({ metric }: { metric: HeatMetric }) {
  const [from, to, low, high] =
    metric === "position"
      ? ["rgba(22,200,158,0.12)", "rgba(22,200,158,1)", UNRANKED_LABEL, "#1"]
      : metric === "popularity"
        ? ["rgba(57,135,229,0.08)", "rgba(57,135,229,1)", "0", "100"]
        : metric === "difficulty"
          ? ["rgba(217,89,38,0.08)", "rgba(217,89,38,1)", "0", "100"]
          : ["rgba(249,115,115,1)", "rgba(0,181,98,1)", "Dropped", "Improved"];
  return (
    <div className="caption-style text-subtle flex items-center gap-2" aria-hidden>
      <span>{low}</span>
      <span className="h-2 w-24 rounded-full" style={{ background: metric === "delta" ? `linear-gradient(90deg, ${from}, #262626, ${to})` : `linear-gradient(90deg, ${from}, ${to})` }} />
      <span>{high}</span>
      <span className="ml-2 size-2.5 rounded-[2px]" style={{ background: NO_DATA, boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)" }} />
      <span>No data</span>
    </div>
  );
}

export default function KeywordHeatmap({
  keywords,
  dates,
  baselineIndex,
  multiCountry,
  onOpen,
}: {
  keywords: TrendKeyword[];
  dates: string[];
  baselineIndex: number | null;
  multiCountry: boolean;
  onOpen: (id: number) => void;
}) {
  const [metric, setMetric] = useState<HeatMetric>("position");
  const [sort, setSort] = useState<SortKey>("popularity");
  const [hover, setHover] = useState<Hover | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const width = cellWidth(dates.length);
  const every = labelEvery(dates.length);

  const rows = useMemo(() => {
    const list = keywords.map((k) => ({ k, popularity: latest(k.popularity, k.since), change: positionChangeOf(k, baselineIndex) }));
    if (sort === "term") return list.sort((a, b) => a.k.term.localeCompare(b.k.term) || a.k.country.localeCompare(b.k.country));
    if (sort === "change") return list.sort((a, b) => (b.change ?? -Infinity) - (a.change ?? -Infinity));
    return list.sort((a, b) => (b.popularity ?? -1) - (a.popularity ?? -1));
  }, [keywords, sort, baselineIndex]);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [dates.length]);

  function onMove(e: MouseEvent<HTMLDivElement>) {
    const cell = (e.target as HTMLElement).closest<HTMLElement>("[data-col]");
    if (!cell) return setHover(null);
    setHover({ x: e.clientX, y: e.clientY, row: Number(cell.dataset.row), col: Number(cell.dataset.col) });
  }

  const hovered = hover ? rows[hover.row]?.k : undefined;

  return (
    <Panel
      title="Ranking heatmap"
      description="Every tracked keyword, day by day. Click a keyword to open its details."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Segmented label="Heatmap metric" value={metric} options={METRICS} onChange={setMetric} />
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger aria-label="Sort keywords" className="h-[30px] w-auto min-w-[150px] rounded-full text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORTS.map((s) => (
                <SelectItem key={s.key} value={s.key}>
                  Sort: {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
    >
      <ScaleLegend metric={metric} />
      <div ref={scroller} className="border-border relative -mx-4 overflow-x-auto border-y" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <div className="w-max min-w-full">
          <div className="bg-card flex h-7 items-end" aria-hidden>
            <div className="bg-card border-border sticky left-0 z-10 h-full w-[150px] shrink-0 border-r sm:w-[200px]" />
            {dates.map((d, i) => (
              <div key={d} className="caption-style text-subtle relative h-full" style={{ flex: `1 0 ${width}px` }}>
                {(dates.length - 1 - i) % every === 0 && <span className={cn("absolute bottom-1 whitespace-nowrap", i === dates.length - 1 ? "right-1" : "left-0")}>{shortDate(d)}</span>}
              </div>
            ))}
          </div>
          <ul aria-label="Keywords">
            {rows.map(({ k, popularity, change }, r) => (
              <li key={k.id} className="group flex h-7 items-stretch">
                <button
                  type="button"
                  onClick={() => onOpen(k.id)}
                  aria-label={`${k.term}${multiCountry ? `, ${k.country.toUpperCase()}` : ""}: position ${formatPosition(k.since == null ? null : k.position[k.position.length - 1])}, popularity ${popularity ?? "unknown"}${change ? `, ${change > 0 ? "up" : "down"} ${Math.abs(change)} positions` : ""}`}
                  className="bg-card group-hover:bg-secondary border-border focus-visible:ring-ring/60 sticky left-0 z-10 flex w-[150px] shrink-0 cursor-pointer items-center gap-1.5 border-r px-4 text-left text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-inset sm:w-[200px]"
                >
                  {multiCountry && <span aria-hidden>{flagOf(k.country)}</span>}
                  <span className="truncate">{k.term}</span>
                  {change != null && change !== 0 && (
                    <span className={cn("caption-style ml-auto shrink-0 tabular-nums", change > 0 ? "text-trend" : "text-danger")}>
                      {change > 0 ? `+${change}` : change}
                    </span>
                  )}
                </button>
                <div className="flex flex-1" aria-hidden>
                  {dates.map((d, c) => (
                    <div
                      key={d}
                      data-row={r}
                      data-col={c}
                      className={cn(
                        "caption-style flex items-center justify-center border-r border-b border-black/30 text-[11px] tabular-nums",
                        hover?.row === r && hover.col === c && "outline outline-white/60 -outline-offset-1",
                      )}
                      style={{ flex: `1 0 ${width}px`, background: colorOf(metric, k, c) }}
                    >
                      {width >= 40 ? cellText(metric, k, c) : null}
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {hover && hovered && (
        <div
          role="tooltip"
          className="bg-popover border-line-strong shadow-overlay pointer-events-none fixed z-50 flex min-w-[170px] flex-col gap-1.5 rounded-lg border px-3 py-2.5"
          style={{ left: Math.min(hover.x + 14, window.innerWidth - 200), top: Math.min(hover.y + 14, window.innerHeight - 150) }}
        >
          <span className="caption-style text-soft">
            {multiCountry ? `${flagOf(hovered.country)} ` : ""}
            {hovered.term} · {shortDate(dates[hover.col])}
          </span>
          {hovered.since == null || hover.col < hovered.since ? (
            <span className="caption-style text-subtle">No data yet</span>
          ) : (
            [
              ["Position", formatPosition(hovered.position[hover.col])],
              ["Change vs day before", deltaText(deltaAt(hovered, hover.col))],
              ["Popularity", hovered.popularity[hover.col] == null ? "—" : String(Math.round(hovered.popularity[hover.col] ?? 0))],
              ["Difficulty", hovered.difficulty[hover.col] == null ? "—" : String(Math.round(hovered.difficulty[hover.col] ?? 0))],
            ].map(([label, value]) => (
              <span key={label} className="caption-style flex justify-between gap-4">
                <span className="text-soft">{label}</span>
                <span className="text-foreground tabular-nums">{value}</span>
              </span>
            ))
          )}
        </div>
      )}
    </Panel>
  );
}
