"use client";

import Link from "next/link";
import { ChevronRight, PlugZap } from "lucide-react";
import { SourceChip } from "@/components/analytics/parts";
import { connectText, revenueLabel, SOURCE_KPI, STEP_META, stepValue } from "@/components/traffic/traffic-format";
import { formatPercent, formatUsd } from "@/lib/client/format";
import type { PortfolioResult, PortfolioStep } from "@/lib/dashboard/portfolio-types";
import { cn } from "@/lib/utils";
import { change } from "./portfolio-format";

function rate(step: PortfolioStep) {
  if (step.rate == null) return null;
  if (step.key === "revenue") return `${formatUsd(step.rate)} ${STEP_META.revenue.from}`;
  return `${formatPercent(step.rate, step.rate < 0.1 ? 2 : 1)} ${STEP_META[step.key].from}`;
}

const SPAN = ["", "", "col-span-2 xl:col-span-2", "col-span-2 sm:col-span-3 xl:col-span-3"];

export default function PortfolioFunnel({ data }: { data: PortfolioResult }) {
  const total = data.apps.length;
  const groups: { step: PortfolioStep; labels: string[]; i: number }[] = [];
  data.steps.forEach((step, i) => {
    const last = groups[groups.length - 1];
    if (last && step.value == null && last.step.value == null && last.step.source === step.source) last.labels.push(STEP_META[step.key].label);
    else groups.push({ step, labels: [STEP_META[step.key].label], i });
  });
  return (
    <section aria-label={`Portfolio funnel over the last ${data.days} days`} className="bg-card border-border overflow-hidden rounded-xl border">
      <div className="flex flex-wrap items-center justify-between gap-3 px-3 pt-2.5 pb-2">
        <h2 className="eyebrow-style text-subtle">
          Impression to revenue · {total === 1 ? "1 app" : `all ${total} apps`} · last {data.days} days
        </h2>
        <span className="caption-style text-subtle">Step rates only compare apps that report both steps</span>
      </div>
      <ol className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7">
        {groups.map(({ step, labels, i }) => {
          const meta = STEP_META[step.key];
          const delta = change(step);
          const text = rate(step);
          const partial = step.connected < total;
          return (
            <li key={step.key} className={cn("border-border relative -mt-px -ml-px flex min-w-0 flex-col gap-2 border-t border-l p-3", SPAN[labels.length])} title={meta.hint}>
              <span className="flex min-w-0 items-center justify-between gap-2">
                <span className="caption-style text-subtle truncate">{labels.join(" · ")}</span>
                <SourceChip source={SOURCE_KPI[step.source]} label={step.source === "revenue" ? revenueLabel(data.revenueProviders) : undefined} />
              </span>
              {step.value == null ? (
                <>
                  <span className="text-faint text-[22px] leading-none font-medium">—</span>
                  <Link href="/integrations" className="caption-style text-soft hover:text-foreground inline-flex items-center gap-1 transition-colors duration-150">
                    <PlugZap aria-hidden className="size-3 shrink-0" />
                    <span className="truncate">{connectText(step.source, "connect")} · 0 of {total} {total === 1 ? "app" : "apps"}</span>
                  </Link>
                </>
              ) : (
                <>
                  <span className="flex items-baseline gap-2">
                    <span className="text-[22px] leading-none font-medium tracking-tight tabular-nums">{stepValue(step.key, step.value)}</span>
                    {delta != null && (
                      <span className={cn("caption-style tabular-nums", Math.abs(delta) < 0.005 ? "text-subtle" : delta > 0 ? "text-trend" : "text-danger")} title="Change versus the previous period of the same length">
                        {delta > 0 ? "▲" : delta < 0 ? "▼" : ""} {Math.abs(delta * 100).toFixed(0)}%
                      </span>
                    )}
                  </span>
                  <span className="caption-style text-subtle flex min-w-0 items-center gap-0.5 tabular-nums">
                    {text ? (
                      <>
                        {i > 0 && <ChevronRight aria-hidden className="size-3 shrink-0" />}
                        <span className="truncate">{text}</span>
                      </>
                    ) : (
                      <span className="truncate">{i === 0 ? "Top of the funnel" : "No app reports both steps"}</span>
                    )}
                  </span>
                  {partial && (
                    <Link href="/integrations" className="caption-style text-warning hover:text-foreground truncate transition-colors duration-150" title={`${total - step.connected} of your apps do not report this step yet, so the total is incomplete`}>
                      {step.connected} of {total} apps connected
                    </Link>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
