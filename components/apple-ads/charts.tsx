"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { shortDate } from "./format";

export const SERIES = { spend: "#3987e5", installs: "#199e70", taps: "#9085e9", cpa: "#d95926" };

type Point = { date: string } & Record<string, number | string | null>;

function ChartTooltip({ active, payload, label, format, name }: { active?: boolean; payload?: { value?: number | null }[]; label?: string; format: (v: number) => string; name: string }) {
  if (!active || !payload?.length || !label) return null;
  const v = payload[0]?.value;
  return (
    <div className="bg-popover border-line-strong shadow-overlay caption-style flex flex-col gap-1.5 rounded-md border px-2.5 py-2">
      <span className="text-subtle">{shortDate(label)}</span>
      <span className="text-foreground tabular-nums">
        {name}: {v == null ? "—" : format(v)}
      </span>
    </div>
  );
}

export function MiniChart({
  title,
  total,
  data,
  dataKey,
  kind,
  color,
  format,
  axisFormat,
  height = 160,
}: {
  title: string;
  total?: string;
  data: Point[];
  dataKey: string;
  kind: "bar" | "area";
  color: string;
  format: (v: number) => string;
  axisFormat?: (v: number) => string;
  height?: number;
}) {
  const tick = { fill: "#676767", fontSize: 11 };
  const common = { data, margin: { top: 8, right: 4, bottom: 0, left: 0 } };
  const axes = (
    <>
      <CartesianGrid vertical={false} stroke="#232323" />
      <XAxis dataKey="date" tickFormatter={shortDate} tick={tick} axisLine={false} tickLine={false} minTickGap={24} />
      <YAxis tickFormatter={axisFormat ?? format} tick={tick} axisLine={false} tickLine={false} width={48} />
      <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)", stroke: "#393939" }} content={<ChartTooltip format={format} name={title} />} />
    </>
  );
  return (
    <figure className="bg-card border-border flex min-w-0 flex-col gap-3 rounded-xl border p-4">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="flex items-center gap-2 text-[13px]">
          <span aria-hidden className="size-2 rounded-full" style={{ background: color }} />
          {title}
        </span>
        {total && <span className="caption-style text-soft tabular-nums">{total}</span>}
      </figcaption>
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          {kind === "bar" ? (
            <BarChart {...common} barCategoryGap={2}>
              {axes}
              <Bar dataKey={dataKey} fill={color} radius={[3, 3, 0, 0]} maxBarSize={18} isAnimationActive={false} />
            </BarChart>
          ) : (
            <AreaChart {...common}>
              <defs>
                <linearGradient id={`fill-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              {axes}
              <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} fill={`url(#fill-${dataKey})`} connectNulls dot={false} activeDot={{ r: 4, stroke: "#161616", strokeWidth: 2 }} isAnimationActive={false} />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
