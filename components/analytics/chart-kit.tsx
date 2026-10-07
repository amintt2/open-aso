"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const SERIES = {
  blue: "#3987e5",
  orange: "#d95926",
  aqua: "#199e70",
} as const;

export const GRID = "#2a2a2a";
export const AXIS_TICK = { fill: "#7f7f7f", fontSize: 11 };

export function shortDate(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export type TooltipRow = { label: string; value: string; color?: string };

export function ChartTooltip({
  active,
  payload,
  label,
  rows,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: unknown }>;
  label?: unknown;
  rows: (point: Record<string, unknown>) => TooltipRow[];
}) {
  const point = payload?.[0]?.payload as Record<string, unknown> | undefined;
  if (!active || !point) return null;
  return (
    <div className="bg-popover border-line-strong shadow-overlay flex min-w-[160px] flex-col gap-2 rounded-lg border px-3 py-2.5">
      <span className="caption-style text-soft">{typeof label === "string" && /^\d{4}-\d{2}-\d{2}$/.test(label) ? shortDate(label) : String(label ?? "")}</span>
      {rows(point).map((row) => (
        <div key={row.label} className="caption-style flex items-center justify-between gap-4">
          <span className="text-soft flex items-center gap-1.5">
            {row.color && <span aria-hidden className="size-2 rounded-[2px]" style={{ background: row.color }} />}
            {row.label}
          </span>
          <span className="text-foreground tabular-nums">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

export function Legend({ items, className }: { items: { label: string; color: string }[]; className?: string }) {
  return (
    <div className={cn("caption-style text-soft flex flex-wrap items-center gap-3", className)}>
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5">
          <span aria-hidden className="size-2 rounded-[2px]" style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

export function Panel({ title, description, actions, children, className }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("bg-card border-border flex min-w-0 flex-col gap-4 rounded-xl border p-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h2 className="h3-style">{title}</h2>
          {description && <p className="caption-style text-subtle">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
