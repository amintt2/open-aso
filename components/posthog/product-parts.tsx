"use client";

import type { ReactNode } from "react";
import { FlaskConical, Info, RefreshCw } from "lucide-react";
import Button from "@/components/_ui/button";
import Tag from "@/components/_ui/tag";
import { timeAgo } from "@/lib/client/format";
import {
  ROLE_LABELS,
  type EventRole,
  type PosthogMeta,
} from "@/lib/posthog/types";
import { cn } from "@/lib/utils";

export function ProductDemoBanner({
  notice,
  onConnect,
}: {
  notice: string | null;
  onConnect: () => void;
}) {
  if (!notice) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-(--tag-amber-border) bg-(--tag-amber-bg) px-4 py-3">
      <span className="flex items-center gap-2 text-(--tag-amber-text)">
        <FlaskConical aria-hidden className="size-4 shrink-0" />
        <p>{notice}</p>
      </span>
      <Button variant="secondary" size="sm" onClick={onConnect}>
        Connect PostHog
      </Button>
    </div>
  );
}

export function Freshness({
  meta,
  onRefresh,
  refreshing,
}: {
  meta: PosthogMeta | undefined;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  return (
    <span className="flex items-center gap-2">
      {meta && !meta.demo && (
        <span className="caption-style text-subtle" title={meta.fetchedAt}>
          {meta.cached
            ? `Cached ${timeAgo(meta.fetchedAt)}`
            : `Updated ${timeAgo(meta.fetchedAt)}`}
        </span>
      )}
      <Button
        variant="secondary"
        size="icon"
        aria-label="Refresh from PostHog"
        title="Refresh from PostHog"
        onClick={onRefresh}
        disabled={refreshing || !meta || meta.demo}
      >
        <RefreshCw
          aria-hidden
          className={cn("size-3.5", refreshing && "animate-spin")}
        />
      </Button>
    </span>
  );
}

export function RoleTag({ role }: { role: EventRole | null }) {
  if (!role) return null;
  const tone =
    role === "purchase_success"
      ? "green"
      : role === "purchase_cancel"
        ? "red"
        : role === "paywall_view" || role === "purchase_start"
          ? "amber"
          : role === "install"
            ? "blue"
            : "neutral";
  return (
    <Tag tone={tone} size="sm" className="text-[12px]">
      {ROLE_LABELS[role]}
    </Tag>
  );
}

export function MissingRoles({
  roles,
  children,
}: {
  roles: EventRole[];
  children?: ReactNode;
}) {
  if (!roles.length) return null;
  return (
    <div className="bg-card border-border flex items-start gap-2 rounded-xl border px-4 py-3">
      <Info aria-hidden className="text-soft mt-0.5 size-4 shrink-0" />
      <p className="text-soft">
        No events mapped for{" "}
        {roles.map((r) => ROLE_LABELS[r].toLowerCase()).join(", ")}.{" "}
        {children ?? "Map them under Integrations → PostHog → Events."}
      </p>
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="bg-secondary flex h-[30px] max-w-full items-center overflow-x-auto rounded-full p-0.5 shadow-[0px_0px_0px_1px_rgba(0,0,0,0.4),inset_0px_1px_0px_0px_rgba(255,255,255,0.1)]"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "caption-style ease-power3-out h-full shrink-0 cursor-pointer rounded-full px-3 whitespace-nowrap transition-colors duration-150",
            value === o.value
              ? "bg-muted text-foreground"
              : "text-subtle hover:text-soft",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function EventName({
  canonical,
  raw,
}: {
  canonical: string;
  raw: string;
}) {
  return (
    <span className="flex min-w-0 flex-col gap-1">
      <span className="truncate">{canonical}</span>
      {canonical !== raw && (
        <span className="caption-style text-subtle truncate font-mono">
          {raw}
        </span>
      )}
    </span>
  );
}

export function scopeLabel(meta: PosthogMeta) {
  const a = meta.app;
  const scope = a.bundleId
    ? `$app_namespace = ${a.bundleId}`
    : a.prefix
      ? `events ${a.prefix}.* and their users' built-ins`
      : "";
  return `${a.name} · ${scope} · last ${meta.days} days`;
}
