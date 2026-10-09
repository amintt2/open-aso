"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Clock,
  Languages,
  Link2Off,
  Plus,
  Sparkles,
  Trophy,
} from "lucide-react";
import Button from "@/components/_ui/button";
import AppIcon from "@/components/shell/app-icon";
import { useApi } from "@/lib/client/api";
import type { AppsResult, DashboardApp } from "@/lib/dashboard/types";
import { useUiStore } from "@/stores/ui-store";
import { Change, Flag, Flags, formatScore } from "./parts";
import Sparkline from "./sparkline";
import { Skeleton, WidgetError } from "./widget";

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="caption-style text-subtle truncate">{label}</span>
      <span className="truncate text-[14px] tabular-nums">{value}</span>
    </div>
  );
}

function Warnings({ app }: { app: DashboardApp }) {
  const w = app.warnings;
  const items = [
    w.unrelated > 0 && {
      icon: AlertTriangle,
      text: `${w.unrelated} unrelated`,
      title: "Keywords judged unrelated to the app",
    },
    w.wrongLanguage > 0 && {
      icon: Languages,
      text: `${w.wrongLanguage} wrong language`,
      title: "Keywords in a script shoppers in that storefront rarely use",
    },
    w.stale > 0 && {
      icon: Clock,
      text: `${w.stale} stale`,
      title: "Keywords not refreshed in 48 hours",
    },
    w.ascNotLinked && {
      icon: Link2Off,
      text: "ASC not linked",
      title: "Not linked to an App Store Connect app",
    },
    w.detectionNeverRun && {
      icon: Sparkles,
      text: "Detect keywords",
      title: "Keyword detection hasn't run for this app",
    },
  ].filter(
    (x): x is { icon: typeof Clock; text: string; title: string } => !!x,
  );
  if (!items.length)
    return <span className="caption-style text-subtle">No warnings</span>;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Warnings">
      {items.map((x) => (
        <li
          key={x.text}
          title={x.title}
          className="caption-style inline-flex h-[20px] items-center gap-1 rounded-full border border-(--tag-amber-border) bg-(--tag-amber-bg) px-1.5 text-(--tag-amber-text)"
        >
          <x.icon aria-hidden className="size-3" />
          {x.text}
        </li>
      ))}
    </ul>
  );
}

function AppCard({ app }: { app: DashboardApp }) {
  return (
    <Link
      href={`/apps/${app.id}`}
      className="bg-card border-border hover:border-line-strong focus-visible:ring-ring/60 flex min-w-0 flex-col gap-3 rounded-xl border p-4 transition-colors duration-150 outline-none focus-visible:ring-2"
    >
      <div className="flex min-w-0 items-center gap-3">
        <AppIcon src={app.iconUrl} name={app.name} className="size-10" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-[14px] font-medium">{app.name}</span>
          <span className="caption-style text-subtle flex min-w-0 items-center gap-2">
            <span className="shrink-0">{app.keywordCount} keywords</span>
            <Flags codes={app.countries} max={5} />
          </span>
        </div>
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="caption-style text-subtle">Visibility · 30d</span>
          <span className="flex items-baseline gap-2">
            <span className="text-[20px] leading-none font-medium tabular-nums">
              {formatScore(app.visibility)}
            </span>
            {app.visibilityChange != null && (
              <Change value={app.visibilityChange} digits={1} />
            )}
          </span>
        </div>
        <Sparkline
          values={app.series.map((p) => p.visibility)}
          className="h-9 w-[55%]"
          label={`${app.name} visibility over 30 days`}
        />
      </div>
      <div className="border-border grid grid-cols-3 gap-2 border-t pt-3">
        <Stat
          label="Avg position"
          value={
            app.avgPosition == null ? "—" : `#${app.avgPosition.toFixed(1)}`
          }
        />
        <Stat
          label="Top 10"
          value={`${app.top10}${app.tracked ? ` / ${app.tracked}` : ""}`}
        />
        <Stat
          label="Best keyword"
          value={
            app.bestKeyword ? (
              <span
                className="flex min-w-0 items-center gap-1"
                title={`${app.bestKeyword.term} · ${app.bestKeyword.position == null ? "not ranked" : `#${app.bestKeyword.position}`}`}
              >
                <Trophy aria-hidden className="text-subtle size-3 shrink-0" />
                <span className="truncate">{app.bestKeyword.term}</span>
                <Flag code={app.bestKeyword.country} className="text-[12px]" />
              </span>
            ) : (
              "—"
            )
          }
        />
      </div>
      <Warnings app={app} />
    </Link>
  );
}

function CardSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="bg-card border-border flex flex-col gap-3 rounded-xl border p-4"
    >
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-[22%]" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

export default function AppsGrid() {
  const { data, error } = useApi<AppsResult>("/api/dashboard/apps");
  const setAddAppOpen = useUiStore((s) => s.setAddAppOpen);
  if (error && !data) return <WidgetError message={error.message} />;
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {data
        ? data.apps.map((app) => <AppCard key={app.id} app={app} />)
        : [0, 1, 2].map((i) => <CardSkeleton key={i} />)}
      {data && (
        <Button
          variant="ghost"
          size="none"
          onClick={() => setAddAppOpen(true)}
          className="border-border min-h-16 flex-col gap-2 rounded-xl border border-dashed md:min-h-[120px]"
        >
          <Plus aria-hidden className="size-4" />
          Add app
        </Button>
      )}
    </div>
  );
}
