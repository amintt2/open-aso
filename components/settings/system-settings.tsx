"use client";

import { Timer, TimerOff } from "lucide-react";
import Tag from "@/components/_ui/tag";
import { formatCompact, timeAgo } from "@/lib/client/format";
import SettingsCard, { KeyValue } from "./settings-card";

type Usage = { apps: number; keywords: number; competitors: number };

export type SystemInfo = {
  workspace: {
    id: string;
    name: string;
    role: "owner" | "admin" | "member";
    canManage: boolean;
  };
  plan: {
    id: string;
    label: string;
    limits: Usage & { countriesPerScan: number; aiRequestsPerDay: number };
    usage: Usage;
  };
  scheduler: {
    disabled: boolean;
    keywords: number;
    staleKeywords: number;
    lastRefreshedAt: string | null;
  };
};

const ROLE_TEXT = {
  owner: "you own this workspace",
  admin: "you're an admin here",
  member: "you're a member here",
} as const;

function limit(n: number) {
  return n >= 1e9 ? "Unlimited" : formatCompact(n);
}

function Meter({
  label,
  used,
  max,
}: {
  label: string;
  used: number;
  max: number;
}) {
  const unlimited = max >= 1e9;
  const share = unlimited || max <= 0 ? 0 : Math.min(1, used / max);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="caption-style text-subtle">{label}</span>
        <span className="caption-style text-soft tabular-nums">
          {formatCompact(used)} / {limit(max)}
        </span>
      </div>
      <div
        className="bg-secondary h-1.5 overflow-hidden rounded-full"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={unlimited ? undefined : max}
        aria-valuenow={used}
      >
        <div
          className={
            share >= 0.9 ? "bg-danger h-full" : "bg-foreground/60 h-full"
          }
          style={{ width: `${unlimited ? 0 : share * 100}%` }}
        />
      </div>
    </div>
  );
}

export function PlanSettings({ info }: { info: SystemInfo | undefined }) {
  const p = info?.plan;
  return (
    <SettingsCard
      id="plan"
      title="Plan & usage"
      description={
        info
          ? `${info.workspace.name} · ${ROLE_TEXT[info.workspace.role]}.`
          : "This workspace's plan and what it uses."
      }
      aside={
        p && (
          <Tag
            tone={p.id === "free" ? "neutral" : "green"}
            size="sm"
            className="text-[12px]"
          >
            {p.label}
          </Tag>
        )
      }
    >
      <div className="grid gap-5 md:grid-cols-3">
        <Meter
          label="Apps"
          used={p?.usage.apps ?? 0}
          max={p?.limits.apps ?? 0}
        />
        <Meter
          label="Keywords"
          used={p?.usage.keywords ?? 0}
          max={p?.limits.keywords ?? 0}
        />
        <Meter
          label="Competitors"
          used={p?.usage.competitors ?? 0}
          max={p?.limits.competitors ?? 0}
        />
      </div>
      <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
        <KeyValue
          label="Countries per scan"
          value={p ? limit(p.limits.countriesPerScan) : "—"}
        />
        <KeyValue
          label="AI requests per day"
          value={p ? limit(p.limits.aiRequestsPerDay) : "—"}
        />
      </div>
    </SettingsCard>
  );
}

export function SchedulerSettings({ info }: { info: SystemInfo | undefined }) {
  const s = info?.scheduler;
  return (
    <SettingsCard
      id="scheduler"
      title="Keyword refresh"
      description="A background job checks every 30 minutes and refreshes tracked keywords that haven't been updated in the last 20 hours, so rankings and popularity history build up daily."
      aside={
        s && (
          <Tag
            tone={s.disabled ? "neutral" : "green"}
            size="sm"
            className="gap-1.5 text-[12px]"
          >
            {s.disabled ? (
              <TimerOff aria-hidden className="size-3" />
            ) : (
              <Timer aria-hidden className="size-3" />
            )}
            {s.disabled ? "Disabled" : "Running"}
          </Tag>
        )
      }
    >
      <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
        <KeyValue
          label="Tracked keywords"
          value={s ? formatCompact(s.keywords) : "—"}
        />
        <KeyValue
          label="Due for refresh"
          value={s ? formatCompact(s.staleKeywords) : "—"}
        />
        <KeyValue
          label="Last refresh"
          value={s ? timeAgo(s.lastRefreshedAt) : "—"}
        />
        <KeyValue
          label="Status"
          value={s ? (s.disabled ? "Disabled on this server" : "Enabled") : "—"}
        />
      </div>
      <p className="caption-style text-subtle">
        Counts cover this workspace. Keywords can always be refreshed manually
        from an app&apos;s keyword list.
      </p>
    </SettingsCard>
  );
}
