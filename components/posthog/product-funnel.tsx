"use client";

import { Panel, SERIES } from "@/components/analytics/chart-kit";
import { KpiTile } from "@/components/analytics/parts";
import { formatCompact, formatPercent } from "@/lib/client/format";
import type { PosthogFunnelResult } from "@/lib/posthog/types";
import { MissingRoles, scopeLabel } from "./product-parts";
import { usePosthogView, type ProductTarget } from "./use-posthog";
import ViewFrame from "./view-frame";

export default function ProductFunnel({
  target,
  onConnect,
}: {
  target: ProductTarget;
  onConnect: () => void;
}) {
  const view = usePosthogView<PosthogFunnelResult>("funnel", target);
  return (
    <ViewFrame {...view} onConnect={onConnect} caption={scopeLabel}>
      {(data) => {
        const first = data.steps[0];
        const last = data.steps[data.steps.length - 1];
        const paywall = data.steps.find((s) => s.role === "paywall_view");
        const success = data.steps.find((s) => s.role === "purchase_success");
        return (
          <>
            <MissingRoles roles={data.missing} />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <KpiTile
                label="Entered funnel"
                value={formatCompact(first?.users ?? 0)}
                hint="People with a first-open event in the period"
              />
              <KpiTile
                label="Overall conversion"
                value={formatPercent(
                  first && last
                    ? first.users
                      ? last.users / first.users
                      : null
                    : null,
                )}
                hint="Last step ÷ first step"
              />
              <KpiTile
                label="Paywall → purchase"
                value={formatPercent(
                  paywall && success && paywall.users
                    ? success.users / paywall.users
                    : null,
                )}
              />
              <KpiTile
                label="Purchase cancelled"
                value={formatPercent(data.cancel.rate)}
                hint={`${data.cancel.cancelled} of ${data.cancel.started} people who started a purchase cancelled it`}
              />
            </div>
            <Panel
              title="Onboarding → purchase funnel"
              description="Each person must complete the steps in order within the period. Steps without mapped events are skipped."
            >
              {data.steps.length ? (
                <ol className="flex flex-col gap-4">
                  {data.steps.map((step, i) => (
                    <li key={step.role} className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <span className="flex min-w-0 items-baseline gap-2">
                          <span className="caption-style text-subtle w-4 tabular-nums">
                            {i + 1}
                          </span>
                          <span>{step.label}</span>
                          <span className="caption-style text-subtle truncate font-mono">
                            {step.events.join(", ")}
                          </span>
                        </span>
                        <span className="caption-style text-soft flex items-center gap-3 tabular-nums">
                          <span className="text-foreground">
                            {formatCompact(step.users)}
                          </span>
                          <span>{formatPercent(step.fromStart)} of start</span>
                          {i > 0 && (
                            <span>
                              {formatPercent(step.fromPrevious)} of previous
                            </span>
                          )}
                          {i > 0 && step.dropOff > 0 && (
                            <span className="text-danger">
                              −{formatCompact(step.dropOff)}
                            </span>
                          )}
                        </span>
                      </div>
                      <span className="bg-track/60 block h-7 w-full overflow-hidden rounded-md">
                        <span
                          className="block h-full rounded-md"
                          style={{
                            width: `${Math.max(1, (step.fromStart ?? 0) * 100)}%`,
                            background:
                              step.role === "purchase_success"
                                ? SERIES.aqua
                                : SERIES.blue,
                          }}
                        />
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-subtle">
                  No funnel events are mapped for this app.
                </p>
              )}
            </Panel>
          </>
        );
      }}
    </ViewFrame>
  );
}
