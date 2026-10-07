"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/_ui/select";
import { Checkbox } from "@/components/_ui/checkbox";
import AppIcon from "@/components/shell/app-icon";
import { useApi } from "@/lib/client/api";
import type { TrackedApp } from "@/lib/client/types";
import { cn } from "@/lib/utils";
import type { AnalyticsFilterState } from "./use-analytics";

const PERIODS = [7, 30, 90];

export default function AnalyticsFilters({
  value,
  onChange,
}: {
  value: AnalyticsFilterState;
  onChange: (next: AnalyticsFilterState) => void;
}) {
  const { data: apps } = useApi<TrackedApp[]>("/api/apps");
  const mine = apps?.filter((a) => a.isMine) ?? [];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="caption-style text-soft flex cursor-pointer items-center gap-1.5 pr-1">
        <Checkbox
          checked={value.sandbox}
          onCheckedChange={(checked) =>
            onChange({ ...value, sandbox: checked === true })
          }
          aria-label="Include sandbox events"
        />
        Sandbox
      </label>
      <Select
        value={value.appId}
        onValueChange={(appId) => onChange({ ...value, appId })}
      >
        <SelectTrigger
          aria-label="App"
          className="h-[30px] w-auto max-w-[220px] min-w-[150px] rounded-full text-[13px]"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All apps</SelectItem>
          {mine.map((app) => (
            <SelectItem key={app.id} value={String(app.id)}>
              <span className="inline-flex items-center gap-2">
                <AppIcon src={app.iconUrl} name={app.name} className="size-4" />
                <span className="truncate">{app.name}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div
        role="radiogroup"
        aria-label="Period"
        className="bg-secondary flex h-[30px] items-center rounded-full p-0.5 shadow-[0px_0px_0px_1px_rgba(0,0,0,0.4),inset_0px_1px_0px_0px_rgba(255,255,255,0.1)]"
      >
        {PERIODS.map((days) => (
          <button
            key={days}
            type="button"
            role="radio"
            aria-checked={value.days === days}
            onClick={() => onChange({ ...value, days })}
            className={cn(
              "caption-style ease-power3-out h-full cursor-pointer rounded-full px-3 transition-colors duration-150",
              value.days === days
                ? "bg-muted text-foreground"
                : "text-subtle hover:text-soft",
            )}
          >
            {days}d
          </button>
        ))}
      </div>
    </div>
  );
}
