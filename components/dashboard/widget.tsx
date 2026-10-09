"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, FlaskConical, PlugZap, TriangleAlert } from "lucide-react";
import Button from "@/components/_ui/button";
import Tag from "@/components/_ui/tag";
import { useApi } from "@/lib/client/api";
import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "bg-secondary/70 block animate-pulse rounded-md",
        className,
      )}
    />
  );
}

export function SkeletonRows({
  rows = 4,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn("flex flex-col gap-2.5", className)}
    >
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-7 w-full" />
      ))}
    </div>
  );
}

export function WidgetError({ message }: { message: string }) {
  return (
    <p className="caption-style text-danger flex items-center gap-1.5 py-4">
      <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
      <span className="min-w-0 truncate" title={message}>
        Couldn&apos;t load this widget: {message}
      </span>
    </p>
  );
}

export function DemoTag({ title }: { title?: string | null }) {
  return (
    <Tag
      tone="amber"
      size="sm"
      className="caption-style h-[20px] gap-1"
      title={title ?? "Synthetic demo data"}
    >
      <FlaskConical aria-hidden className="size-3" />
      Demo
    </Tag>
  );
}

export function EstimateTag() {
  return (
    <Tag
      tone="neutral"
      size="sm"
      className="caption-style h-[20px]"
      title="Modelled from popularity × rank. Not observed data."
    >
      Estimate
    </Tag>
  );
}

export function ConnectHint({
  label,
  href,
  children,
  className,
}: {
  label: string;
  href: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-start gap-2 py-3", className)}>
      {children && <p className="caption-style text-subtle">{children}</p>}
      <Button variant="secondary" size="sm" href={href}>
        <PlugZap aria-hidden className="size-3.5" />
        {label}
      </Button>
    </div>
  );
}

export function MoreLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="caption-style text-subtle hover:text-foreground inline-flex shrink-0 items-center gap-1 transition-colors duration-150"
    >
      {children}
      <ArrowRight aria-hidden className="size-3" />
    </Link>
  );
}

export function Card({
  title,
  description,
  badge,
  actions,
  className,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "bg-card border-border flex min-w-0 flex-col gap-3 rounded-xl border p-4",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-[min(100%,180px)] flex-1 flex-col gap-1">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="h3-style truncate">{title}</h2>
            {badge}
          </div>
          {description && (
            <p className="caption-style text-subtle">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        )}
      </div>
      {children}
    </section>
  );
}

export function Widget<T>({
  url,
  refreshInterval,
  loading,
  children,
}: {
  url: string | null;
  refreshInterval?: number;
  loading?: ReactNode;
  children: (data: T) => ReactNode;
}) {
  const { data, error } = useApi<T>(url, {
    refreshInterval,
    keepPreviousData: true,
  });
  if (error && !data) return <WidgetError message={error.message} />;
  if (!data) return <>{loading ?? <SkeletonRows />}</>;
  return <>{children(data)}</>;
}
