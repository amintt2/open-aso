"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS_TICK, ChartTooltip, GRID, Legend, Panel, shortDate } from "@/components/analytics/chart-kit";
import { Tabs, TabsList, TabsTrigger } from "@/components/_ui/tabs";
import { UNRANKED, type TrendKeyword, type TrendVersion } from "@/lib/trends/types";
import KeywordPicker from "./keyword-picker";
import { formatPosition, keywordLabel, LINE_COLORS, UNRANKED_LABEL } from "./trends-format";
import { tickInterval } from "./visibility-chart";

type Metric = "position" | "popularity" | "difficulty";

const METRICS: { key: Metric; label: string }[] = [
  { key: "position", label: "Position" },
  { key: "popularity", label: "Popularity" },
  { key: "difficulty", label: "Difficulty" },
];

const POSITION_TICKS = [1, 3, 10, 30, 100, UNRANKED];

function valueAt(k: TrendKeyword, metric: Metric, i: number) {
  if (k.since == null || i < k.since) return null;
  if (metric === "position") return k.position[i] ?? UNRANKED;
  return k[metric][i];
}

export default function KeywordCompare({
  keywords,
  dates,
  versions,
  selected,
  multiCountry,
  onSelect,
}: {
  keywords: TrendKeyword[];
  dates: string[];
  versions: TrendVersion[];
  selected: number[];
  multiCountry: boolean;
  onSelect: (ids: number[]) => void;
}) {
  const [metric, setMetric] = useState<Metric>("position");
  const byId = useMemo(() => new Map(keywords.map((k) => [k.id, k])), [keywords]);
  const lines = useMemo(
    () => selected.map((id, i) => ({ k: byId.get(id), color: LINE_COLORS[i % LINE_COLORS.length] })).filter((l): l is { k: TrendKeyword; color: string } => !!l.k),
    [selected, byId],
  );
  const colors = useMemo(() => new Map(lines.map((l) => [l.k.id, l.color])), [lines]);
  const data = useMemo(
    () =>
      dates.map((date, i) => {
        const row: Record<string, string | number | null> = { date };
        for (const { k } of lines) row[`k${k.id}`] = valueAt(k, metric, i);
        return row;
      }),
    [dates, lines, metric],
  );

  return (
    <Panel
      title="Keyword comparison"
      description="Compare up to 8 keywords side by side. Popularity and difficulty are Open ASO scores (0–100)."
      actions={
        <Tabs value={metric} onValueChange={(v) => setMetric(v as Metric)}>
          <TabsList aria-label="Comparison metric">
            {METRICS.map((m) => (
              <TabsTrigger key={m.key} value={m.key} className="py-2">
                {m.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      }
    >
      <KeywordPicker keywords={keywords} selected={selected} colors={colors} multiCountry={multiCountry} onChange={onSelect} />
      <div className="h-[300px]" role="img" aria-label={`${METRICS.find((m) => m.key === metric)?.label} of ${lines.length} keywords over time`}>
        {lines.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: -6 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS_TICK} axisLine={false} tickLine={false} interval={tickInterval(dates.length)} />
              {metric === "position" ? (
                <YAxis
                  scale="log"
                  reversed
                  domain={[1, UNRANKED]}
                  ticks={POSITION_TICKS}
                  interval={0}
                  allowDataOverflow
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                  tickFormatter={(v: number) => (v >= UNRANKED ? UNRANKED_LABEL : `#${v}`)}
                />
              ) : (
                <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} />
              )}
              {versions.map((v) => (
                <ReferenceLine key={v.version} x={v.date} stroke="var(--faint)" strokeDasharray="3 3" />
              ))}
              <Tooltip
                cursor={{ stroke: "rgba(255,255,255,0.2)" }}
                content={(props) => (
                  <ChartTooltip
                    {...props}
                    rows={(pt) =>
                      lines.map(({ k, color }) => {
                        const v = pt[`k${k.id}`] as number | null | undefined;
                        return {
                          label: keywordLabel(k, multiCountry),
                          color,
                          value: v == null ? "—" : metric === "position" ? formatPosition(v >= UNRANKED ? null : v) : String(Math.round(v)),
                        };
                      })
                    }
                  />
                )}
              />
              {lines.map(({ k, color }) => (
                <Line
                  key={k.id}
                  type="monotone"
                  dataKey={`k${k.id}`}
                  name={k.term}
                  stroke={color}
                  strokeWidth={2}
                  dot={dates.length <= 31 ? { r: 2.5, strokeWidth: 0, fill: color } : false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--background)" }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-subtle flex h-full items-center justify-center">
            <p>Pick keywords above to compare them.</p>
          </div>
        )}
      </div>
      {lines.length > 0 && <Legend items={lines.map(({ k, color }) => ({ label: keywordLabel(k, multiCountry), color }))} />}
    </Panel>
  );
}
