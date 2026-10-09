"use client";

import { COUNTRY_BY_CODE } from "@/lib/appstore/countries";
import type { Period } from "@/lib/dashboard/types";
import { cn } from "@/lib/utils";

export function Flag({
  code,
  className,
}: {
  code: string;
  className?: string;
}) {
  const c = COUNTRY_BY_CODE.get(code);
  return (
    <span
      role="img"
      aria-label={c?.name ?? code.toUpperCase()}
      title={c?.name ?? code.toUpperCase()}
      className={cn("shrink-0", className)}
    >
      {c?.flag ?? code.toUpperCase()}
    </span>
  );
}

export function Flags({ codes, max = 6 }: { codes: string[]; max?: number }) {
  const shown = codes.slice(0, max);
  return (
    <span className="inline-flex items-center gap-1">
      {shown.map((c) => (
        <Flag key={c} code={c} className="text-[13px] leading-none" />
      ))}
      {codes.length > max && (
        <span className="caption-style text-subtle">+{codes.length - max}</span>
      )}
    </span>
  );
}

function tone(change: number, invert: boolean, epsilon: number) {
  if (Math.abs(change) < epsilon) return "text-subtle";
  return (invert ? change < 0 : change > 0) ? "text-trend" : "text-danger";
}

export function PctDelta({
  period,
  invert = false,
  suffix = "vs prior 7d",
}: {
  period: Period | null | undefined;
  invert?: boolean;
  suffix?: string;
}) {
  if (!period || period.previous == null || period.previous === 0)
    return (
      <span className="caption-style text-subtle">
        {period && period.previous === 0 && period.current > 0
          ? "none in the prior period"
          : "no prior data"}
      </span>
    );
  const change = (period.current - period.previous) / Math.abs(period.previous);
  return (
    <span
      className={cn("caption-style tabular-nums", tone(change, invert, 0.005))}
    >
      {change > 0 ? "▲" : change < 0 ? "▼" : ""}{" "}
      {Math.abs(change * 100).toFixed(1)}%
      <span className="text-subtle"> {suffix}</span>
    </span>
  );
}

export function AbsDelta({
  period,
  invert = false,
  digits = 0,
  unit = "",
  suffix = "vs 7d ago",
}: {
  period: Period | null | undefined;
  invert?: boolean;
  digits?: number;
  unit?: string;
  suffix?: string;
}) {
  if (!period || period.previous == null)
    return <span className="caption-style text-subtle">no prior data</span>;
  const change = period.current - period.previous;
  const shown = Math.abs(change).toFixed(digits);
  return (
    <span
      className={cn(
        "caption-style tabular-nums",
        tone(change, invert, digits ? 0.05 : 0.5),
      )}
    >
      {Number(shown) === 0 ? "±0" : `${change > 0 ? "▲" : "▼"} ${shown}`}
      {unit}
      <span className="text-subtle"> {suffix}</span>
    </span>
  );
}

export function Change({
  value,
  invert = false,
  digits = 0,
  className,
}: {
  value: number | null | undefined;
  invert?: boolean;
  digits?: number;
  className?: string;
}) {
  if (value == null || Math.abs(value) < (digits ? 0.05 : 0.5))
    return (
      <span className={cn("caption-style text-subtle tabular-nums", className)}>
        ±0
      </span>
    );
  return (
    <span
      className={cn(
        "caption-style tabular-nums",
        tone(value, invert, 0),
        className,
      )}
    >
      {value > 0 ? "▲" : "▼"}
      {Math.abs(value).toFixed(digits)}
    </span>
  );
}

export function SectionTitle({
  children,
  actions,
}: {
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
      <h2 className="eyebrow-style text-subtle">{children}</h2>
      {actions}
    </div>
  );
}

export function formatScore(v: number | null | undefined) {
  if (v == null) return "—";
  return v > 0 && v < 0.1 ? "<0.1" : v.toFixed(1);
}
