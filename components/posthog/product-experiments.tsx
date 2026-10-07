"use client";

import { FlaskConical } from "lucide-react";
import EmptyState from "@/components/shell/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import { Panel } from "@/components/analytics/chart-kit";
import { formatCompact, formatPercent } from "@/lib/client/format";
import type { ExperimentRow, PosthogExperimentsResult } from "@/lib/posthog/types";
import { cn } from "@/lib/utils";
import { MissingRoles, scopeLabel } from "./product-parts";
import { usePosthogView, type ProductTarget } from "./use-posthog";
import ViewFrame from "./view-frame";

function Lift({ value, base }: { value: number | null; base: number | null }) {
  if (value == null || base == null || base === 0) return <span className="text-subtle">—</span>;
  const lift = value / base - 1;
  return <span className={cn("tabular-nums", Math.abs(lift) < 0.005 ? "text-subtle" : lift > 0 ? "text-trend" : "text-danger")}>{`${lift > 0 ? "+" : ""}${(lift * 100).toFixed(1)}%`}</span>;
}

function ExperimentTable({ experiment }: { experiment: ExperimentRow }) {
  const base = experiment.variants.find((v) => v.variant === "control") ?? experiment.variants[0];
  return (
    <Panel title={<span className="font-mono">{experiment.flag}</span>} description={`${formatCompact(experiment.users)} exposed people · lift is relative to ${base?.variant ?? "the first variant"}`}>
      <div className="-mx-4 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Variant</TableHead>
              <TableHead className="text-right">Exposed</TableHead>
              <TableHead className="text-right">Paywall viewed</TableHead>
              <TableHead className="text-right">Lift</TableHead>
              <TableHead className="text-right">Purchased</TableHead>
              <TableHead className="pr-4 text-right">Lift</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {experiment.variants.map((v) => (
              <TableRow key={v.variant}>
                <TableCell className="pl-4 font-mono">{v.variant}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCompact(v.users)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPercent(v.paywallRate)} <span className="text-subtle">· {formatCompact(v.paywallUsers)}</span>
                </TableCell>
                <TableCell className="text-right">{v === base ? <span className="text-subtle">base</span> : <Lift value={v.paywallRate} base={base?.paywallRate ?? null} />}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPercent(v.purchaseRate)} <span className="text-subtle">· {formatCompact(v.purchaseUsers)}</span>
                </TableCell>
                <TableCell className="pr-4 text-right">{v === base ? <span className="text-subtle">base</span> : <Lift value={v.purchaseRate} base={base?.purchaseRate ?? null} />}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Panel>
  );
}

export default function ProductExperiments({ target, onConnect }: { target: ProductTarget; onConnect: () => void }) {
  const view = usePosthogView<PosthogExperimentsResult>("experiments", target);
  return (
    <ViewFrame {...view} onConnect={onConnect} caption={(d) => `${scopeLabel(d)} · $feature_flag_called and $experiment_exposure`}>
      {(data) => (
        <>
          <MissingRoles roles={(["paywall_view", "purchase_success"] as const).filter((r) => !data.roles[r].length)} />
          {data.experiments.length ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {data.experiments.map((e) => (
                <ExperimentTable key={e.flag} experiment={e} />
              ))}
            </div>
          ) : (
            <EmptyState icon={FlaskConical} title="No flag exposures" description="Nothing called a feature flag or sent $experiment_exposure for this app in the period." />
          )}
          <p className="caption-style text-subtle">Rates count people who viewed a paywall or purchased after their first exposure. Small samples are noisy — check significance in PostHog Experiments before shipping a winner.</p>
        </>
      )}
    </ViewFrame>
  );
}
