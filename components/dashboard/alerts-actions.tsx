"use client";

import Link from "next/link";
import {
  CircleAlert,
  CircleCheck,
  Info,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import AppIcon from "@/components/shell/app-icon";
import { useApi } from "@/lib/client/api";
import type { AlertSeverity, DashboardAlert } from "@/lib/dashboard/types";
import { cn } from "@/lib/utils";
import { SkeletonRows, WidgetError } from "./widget";

const ICON: Record<
  AlertSeverity,
  { icon: LucideIcon; className: string; label: string }
> = {
  high: { icon: CircleAlert, className: "text-danger", label: "High" },
  medium: { icon: TriangleAlert, className: "text-warning", label: "Medium" },
  low: { icon: Info, className: "text-subtle", label: "Info" },
};

export function AlertsList({ limit = 8 }: { limit?: number }) {
  const { data, error } = useApi<DashboardAlert[]>("/api/dashboard/alerts");
  if (error && !data) return <WidgetError message={error.message} />;
  if (!data) return <SkeletonRows rows={4} />;
  if (!data.length)
    return (
      <p className="caption-style text-subtle flex items-center gap-2 py-6">
        <CircleCheck aria-hidden className="text-trend size-4" />
        All clear. No ranking drops or integration errors.
      </p>
    );
  return (
    <ul className="flex flex-col">
      {data.slice(0, limit).map((a) => {
        const s = ICON[a.severity];
        return (
          <li key={a.id}>
            <Link
              href={a.href}
              className="-mx-2 flex min-w-0 items-start gap-2.5 rounded-lg px-2 py-2 transition-colors duration-150 hover:bg-white/4"
            >
              <s.icon
                aria-label={s.label}
                className={cn("mt-0.5 size-3.5 shrink-0", s.className)}
              />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[13px]">{a.title}</span>
                <span
                  className="caption-style text-subtle truncate"
                  title={a.detail}
                >
                  {a.detail}
                </span>
              </span>
              {a.app && (
                <AppIcon
                  src={a.app.iconUrl}
                  name={a.app.appName}
                  className="size-5"
                />
              )}
            </Link>
          </li>
        );
      })}
      {data.length > limit && (
        <li className="caption-style text-subtle pt-1">
          +{data.length - limit} more
        </li>
      )}
    </ul>
  );
}
