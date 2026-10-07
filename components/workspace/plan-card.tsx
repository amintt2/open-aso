import Tag from "@/components/_ui/tag";
import type { WorkspaceDetails } from "@/lib/workspace/types";
import { cn } from "@/lib/utils";
import SectionCard from "./section-card";

function fmt(n: number) {
  return n >= 1e8 ? "∞" : n.toLocaleString("en-US");
}

export function UsageBar({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number;
}) {
  const unlimited = limit >= 1e8;
  const pct = unlimited ? 0 : Math.min(100, (used / Math.max(1, limit)) * 100);
  const tone =
    pct >= 100
      ? "bg-danger"
      : pct >= 80
        ? "bg-(--tag-amber-text)"
        : "bg-primary";
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="caption-style text-soft">{label}</span>
        <span className="caption-style text-subtle tabular-nums">
          {fmt(used)} / {unlimited ? "Unlimited" : fmt(limit)}
        </span>
      </div>
      <div
        className="bg-secondary h-1.5 overflow-hidden rounded-full"
        role="progressbar"
        aria-label={label}
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={unlimited ? undefined : limit}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300",
            unlimited ? "bg-trend w-full opacity-30" : tone,
          )}
          style={unlimited ? undefined : { width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function PlanCard({
  workspace,
}: {
  workspace: WorkspaceDetails;
}) {
  const { usage, limits } = workspace;
  return (
    <SectionCard
      id="plan"
      title="Plan & usage"
      description="Limits apply to the whole workspace. Contact the instance admin to change plans."
      aside={
        <Tag
          tone={
            workspace.plan === "free"
              ? "neutral"
              : workspace.plan === "pro"
                ? "purple"
                : "green"
          }
          size="md"
        >
          {workspace.planLabel}
        </Tag>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <UsageBar label="Apps" used={usage.apps} limit={limits.apps} />
        <UsageBar
          label="Tracked keywords"
          used={usage.keywords}
          limit={limits.keywords}
        />
        <UsageBar
          label="Competitors"
          used={usage.competitors}
          limit={limits.competitors}
        />
        <UsageBar
          label="Members"
          used={workspace.members.length}
          limit={workspace.memberLimit}
        />
      </div>
      <p className="caption-style text-subtle">
        Up to {fmt(limits.countriesPerScan)} countries per scan ·{" "}
        {fmt(limits.aiRequestsPerDay)} AI requests per day
      </p>
    </SectionCard>
  );
}
