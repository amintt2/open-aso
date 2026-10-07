"use client";

import Link from "next/link";
import { Check, CircleAlert, FlaskConical, Plus } from "lucide-react";
import type { ImpactDataSources, SourceState } from "@/lib/impact/types";
import { cn } from "@/lib/utils";

const SOURCES: { key: keyof Omit<ImpactDataSources, "observed" | "errors">; label: string; href: string; use: string }[] = [
  { key: "posthog", label: "PostHog", href: "/integrations", use: "new users per country" },
  { key: "sdk", label: "Open ASO SDK", href: "/integrations", use: "installs by source" },
  { key: "revenue", label: "RevenueCat / Superwall", href: "/integrations", use: "revenue per country" },
  { key: "appleAds", label: "Apple Ads", href: "/apple-ads", use: "paid installs per keyword" },
];

const ICON: Record<SourceState, typeof Check> = { connected: Check, missing: Plus, error: CircleAlert, demo: FlaskConical };

export default function ImpactSources({ sources }: { sources: ImpactDataSources }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="caption-style text-subtle">Data</span>
      {SOURCES.map((s) => {
        const state = sources[s.key];
        const Icon = ICON[state];
        const used = (s.key === "posthog" && sources.observed === "posthog") || (s.key === "sdk" && sources.observed === "sdk");
        const title = state === "connected" ? `${s.label}: ${s.use}${used ? " (used for observed installs)" : ""}` : state === "missing" ? `Connect ${s.label} for ${s.use}` : state === "error" ? `${s.label} could not be read` : `${s.label}: demo data`;
        const chip = (
          <span
            title={title}
            className={cn(
              "caption-style inline-flex h-[24px] items-center gap-1.5 rounded-full border px-2",
              state === "connected" && "border-(--tag-green-border) bg-(--tag-green-bg) text-(--tag-green-text)",
              state === "missing" && "border-line-strong text-subtle hover:text-soft border-dashed",
              state === "error" && "border-(--tag-red-border) bg-(--tag-red-bg) text-(--tag-red-text)",
              state === "demo" && "border-(--tag-amber-border) bg-(--tag-amber-bg) text-(--tag-amber-text)",
            )}
          >
            <Icon aria-hidden className="size-3" />
            {s.label}
          </span>
        );
        return state === "connected" || state === "demo" ? (
          <span key={s.key}>{chip}</span>
        ) : (
          <Link key={s.key} href={s.href} className="rounded-full">
            {chip}
          </Link>
        );
      })}
    </div>
  );
}
