"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Panel } from "@/components/analytics/chart-kit";
import { UNRANKED, type TrendKeyword, type TrendMover } from "@/lib/trends/types";
import { cn } from "@/lib/utils";
import { flagOf, formatPosition } from "./trends-format";

const W = 84;
const H = 26;
const LOG_MAX = Math.log(UNRANKED);

function Sparkline({ keyword, from, color }: { keyword: TrendKeyword | undefined; from: number; color: string }) {
  if (!keyword || keyword.since == null) return <span className="w-[84px]" />;
  const start = Math.max(from, keyword.since);
  const values = keyword.position.slice(start).map((p) => Math.log(p ?? UNRANKED) / LOG_MAX);
  if (values.length < 2) return <span className="w-[84px]" />;
  const min = Math.min(...values);
  const span = Math.max(...values) - min || 1;
  const step = W / (values.length - 1);
  const d = values.map((v, i) => `${i ? "L" : "M"}${(i * step).toFixed(1)},${(2 + ((v - min) / span) * (H - 4)).toFixed(1)}`).join(" ");
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden className="shrink-0">
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function MoverList({
  title,
  description,
  movers,
  keywords,
  from,
  tone,
  multiCountry,
  onOpen,
}: {
  title: string;
  description: string;
  movers: TrendMover[];
  keywords: Map<number, TrendKeyword>;
  from: number;
  tone: "up" | "down";
  multiCountry: boolean;
  onOpen: (id: number) => void;
}) {
  const color = tone === "up" ? "var(--trend)" : "var(--danger)";
  const Icon = tone === "up" ? ArrowUpRight : ArrowDownRight;
  return (
    <Panel title={title} description={description}>
      {movers.length ? (
        <ul className="-mx-2 flex flex-col">
          {movers.slice(0, 6).map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => onOpen(m.id)}
                aria-label={`${m.term}${multiCountry ? `, ${m.country.toUpperCase()}` : ""}: ${formatPosition(m.startPosition)} to ${formatPosition(m.endPosition)}`}
                className="focus-visible:ring-ring/60 flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-left outline-none hover:bg-white/4 focus-visible:ring-2"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex min-w-0 items-center gap-1.5 text-[14px]">
                    {multiCountry && <span aria-hidden>{flagOf(m.country)}</span>}
                    <span className="truncate">{m.term}</span>
                  </span>
                  <span className="caption-style text-subtle tabular-nums">
                    {formatPosition(m.startPosition)} → {formatPosition(m.endPosition)}
                  </span>
                </span>
                <Sparkline keyword={keywords.get(m.id)} from={from} color={color} />
                <span className={cn("caption-style flex w-12 shrink-0 items-center justify-end gap-0.5 tabular-nums", tone === "up" ? "text-trend" : "text-danger")}>
                  <Icon aria-hidden className="size-3.5" />
                  {Math.abs(m.positionChange)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-subtle py-6 text-center">{tone === "up" ? "No keyword moved up in this period." : "No keyword dropped in this period."}</p>
      )}
    </Panel>
  );
}

export default function TrendMovers({
  gainers,
  losers,
  keywords,
  from,
  multiCountry,
  onOpen,
}: {
  gainers: TrendMover[];
  losers: TrendMover[];
  keywords: Map<number, TrendKeyword>;
  from: number;
  multiCountry: boolean;
  onOpen: (id: number) => void;
}) {
  const shared = { keywords, from, multiCountry, onOpen };
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <MoverList title="Biggest gains" description="Largest position improvements over the period." movers={gainers} tone="up" {...shared} />
      <MoverList title="Biggest drops" description="Largest position losses over the period." movers={losers} tone="down" {...shared} />
    </div>
  );
}
