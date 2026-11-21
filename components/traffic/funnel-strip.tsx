"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, PlugZap } from "lucide-react";
import { SourceChip } from "@/components/analytics/parts";
import { formatPercent, formatUsd } from "@/lib/client/format";
import type { TrafficResult, TrafficStep } from "@/lib/traffic/types";
import { cn } from "@/lib/utils";
import { connectText, revenueLabel, SOURCE_KPI, STEP_META, stepValue } from "./traffic-format";

function conversion(step: TrafficStep, previous: TrafficStep | undefined, downloads: number | null) {
  if (step.value == null) return null;
  if (step.key === "revenue") return downloads ? `${formatUsd(step.value / downloads)} ${STEP_META.revenue.from}` : null;
  if (!previous || previous.value == null || previous.value <= 0) return null;
  return `${formatPercent(step.value / previous.value, step.value / previous.value < 0.1 ? 2 : 1)} ${STEP_META[step.key].from}`;
}

function Change({ step }: { step: TrafficStep }) {
  if (step.value == null || step.previous == null || step.previous === 0) return null;
  const change = (step.value - step.previous) / Math.abs(step.previous);
  return (
    <span className={cn("caption-style tabular-nums", Math.abs(change) < 0.005 ? "text-subtle" : change > 0 ? "text-trend" : "text-danger")} title="Change versus the previous period of the same length">
      {change > 0 ? "▲" : change < 0 ? "▼" : ""} {Math.abs(change * 100).toFixed(0)}%
    </span>
  );
}

type Group = { steps: TrafficStep[]; index: number };

const SPAN = ["", "", "col-span-2 xl:col-span-2", "col-span-2 sm:col-span-3 xl:col-span-3"];

function groups(steps: TrafficStep[]) {
  const out: Group[] = [];
  steps.forEach((step, index) => {
    const last = out[out.length - 1];
    if (last && step.value == null && last.steps[0].value == null && last.steps[0].source === step.source) last.steps.push(step);
    else out.push({ steps: [step], index });
  });
  return out;
}

const CELL = "border-border relative -mt-px -ml-px flex min-w-0 flex-col gap-2 border-t border-l p-3";

export default function FunnelStrip({ data, href, action }: { data: TrafficResult; href?: string; action?: ReactNode }) {
  const downloads = data.steps.find((s) => s.key === "downloads")?.value ?? null;
  const name = (step: TrafficStep) => (step.key === "purchases" && data.payersOnly ? "Paying users" : STEP_META[step.key].label);
  return (
    <section aria-label={`Funnel over the last ${data.days} days`} className="bg-card border-border overflow-hidden rounded-xl border">
      <div className="flex items-center justify-between gap-3 px-3 pt-2.5 pb-2">
        <h2 className="eyebrow-style text-subtle">
          Impression to revenue · last {data.days} days · {data.country === "all" ? "all countries" : data.country.toUpperCase()}
        </h2>
        {action}
      </div>
      <ol className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7">
        {groups(data.steps).map(({ steps, index }) => {
          const step = steps[0];
          const source = data.sources[step.source];
          const chip = <SourceChip source={SOURCE_KPI[step.source]} label={step.source === "revenue" ? revenueLabel(data.revenueProviders) : undefined} />;
          if (step.value == null)
            return (
              <li key={step.key} className={cn(CELL, SPAN[steps.length])} title={steps.map((s) => STEP_META[s.key].hint).join(" ")}>
                <span className="flex min-w-0 items-center justify-between gap-2">
                  <span className="caption-style text-subtle truncate">{steps.map(name).join(" · ")}</span>
                  {chip}
                </span>
                <span className="text-faint text-[22px] leading-none font-medium">—</span>
                <Link
                  href={source.state === "setup" && step.source === "apple" && href ? `${href}?view=sources` : "/integrations"}
                  className={cn("caption-style inline-flex items-center gap-1 transition-colors duration-150", source.state === "error" ? "text-danger" : "text-soft hover:text-foreground")}
                  title={source.message ?? undefined}
                >
                  <PlugZap aria-hidden className="size-3 shrink-0" />
                  <span className="truncate">{connectText(step.source, source.state)}</span>
                </Link>
              </li>
            );
          const rate = conversion(step, data.steps[index - 1], downloads);
          return (
            <li key={step.key} className={CELL} title={STEP_META[step.key].hint}>
              <span className="flex min-w-0 items-center justify-between gap-2">
                <span className="caption-style text-subtle truncate">{name(step)}</span>
                {chip}
              </span>
              <span className="flex items-baseline gap-2">
                <span className="text-[22px] leading-none font-medium tracking-tight tabular-nums">{stepValue(step.key, step.value)}</span>
                <Change step={step} />
              </span>
              <span className="caption-style text-subtle flex min-w-0 items-center gap-0.5 truncate tabular-nums">
                {rate ? (
                  <>
                    {index > 0 && <ChevronRight aria-hidden className="size-3 shrink-0" />}
                    <span className="truncate">{rate}</span>
                  </>
                ) : index === 0 ? (
                  "Top of the funnel"
                ) : (
                  "No step before to compare"
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
