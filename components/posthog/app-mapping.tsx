"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { mutate } from "swr";
import Button from "@/components/_ui/button";
import Tag from "@/components/_ui/tag";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/_ui/select";
import AppIcon from "@/components/shell/app-icon";
import { api, useApi } from "@/lib/client/api";
import { formatCompact, timeAgo } from "@/lib/client/format";
import type { DiscoveryResult, MappedTrackedApp } from "@/lib/posthog/types";
import { cn } from "@/lib/utils";
import { refreshPosthog } from "./connection-section";

const APPS_URL = "/api/posthog/apps";

function currentValue(app: MappedTrackedApp) {
  const m = app.mapping;
  if (!m) return "none";
  return m.bundleId ? `b:${m.bundleId}` : m.prefix ? `p:${m.prefix}` : "none";
}

function AppRow({
  app,
  data,
  onChange,
  busy,
}: {
  app: MappedTrackedApp;
  data: DiscoveryResult;
  onChange: (app: MappedTrackedApp, value: string) => void;
  busy: boolean;
}) {
  const value = currentValue(app);
  const bundles = data.bundles.map((b) => b.bundleId);
  const prefixes = data.prefixes.map((p) => p.prefix);
  const stale =
    value !== "none" &&
    !(value.startsWith("b:")
      ? bundles.includes(value.slice(2))
      : prefixes.includes(value.slice(2)));
  const suggestion =
    !app.mapping && app.suggestion
      ? app.suggestion.bundleId
        ? `b:${app.suggestion.bundleId}`
        : app.suggestion.prefix
          ? `p:${app.suggestion.prefix}`
          : null
      : null;
  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2.5">
          <AppIcon src={app.iconUrl} name={app.name} className="size-7" />
          <span className="flex min-w-0 flex-col gap-1">
            <span className="truncate">{app.name}</span>
            <span className="caption-style text-subtle truncate font-mono">
              {app.bundleId ?? "no bundle id"}
            </span>
          </span>
        </span>
        {app.mapping?.auto && (
          <Tag tone="green" size="sm" className="text-[12px]">
            Auto-matched
          </Tag>
        )}
      </div>
      <Select
        value={value}
        onValueChange={(v) => onChange(app, v)}
        disabled={busy}
      >
        <SelectTrigger
          aria-label={`PostHog mapping for ${app.name}`}
          className={cn(value === "none" && "text-subtle")}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Not mapped</SelectItem>
          {stale && (
            <SelectItem value={value}>
              {value.startsWith("b:")
                ? `$app_namespace = ${value.slice(2)}`
                : `${value.slice(2)}.* events`}{" "}
              (not seen in 30 days)
            </SelectItem>
          )}
          {data.bundles.map((b) => (
            <SelectItem key={`b:${b.bundleId}`} value={`b:${b.bundleId}`}>
              {`$app_namespace = ${b.bundleId}`}
              {b.appName ? ` · ${b.appName}` : ""} · {formatCompact(b.events)}{" "}
              events
            </SelectItem>
          ))}
          {data.prefixes.map((p) => (
            <SelectItem key={`p:${p.prefix}`} value={`p:${p.prefix}`}>
              {`${p.prefix}.* events`} · {formatCompact(p.events)} events
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {suggestion && (
        <div className="flex items-center justify-between gap-2">
          <span className="caption-style text-soft">
            Suggested:{" "}
            {suggestion.startsWith("b:")
              ? suggestion.slice(2)
              : `${suggestion.slice(2)}.* events`}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onChange(app, suggestion)}
            disabled={busy}
          >
            Use suggestion
          </Button>
        </div>
      )}
    </li>
  );
}

export default function AppMapping({ canManage }: { canManage: boolean }) {
  const { data, error } = useApi<DiscoveryResult>(APPS_URL, {
    shouldRetryOnError: false,
  });
  const [busy, setBusy] = useState(false);

  async function rediscover() {
    setBusy(true);
    try {
      await mutate(
        APPS_URL,
        await api<DiscoveryResult>(`${APPS_URL}?refresh=1`),
        { revalidate: false },
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Discovery failed");
    } finally {
      setBusy(false);
    }
  }

  async function change(app: MappedTrackedApp, value: string) {
    if (!data) return;
    setBusy(true);
    try {
      if (value === "none")
        await api(`${APPS_URL}/${app.id}`, { method: "DELETE" });
      else if (value.startsWith("b:")) {
        const bundle = data.bundles.find((b) => b.bundleId === value.slice(2));
        await api(`${APPS_URL}/${app.id}`, {
          method: "PUT",
          body: { bundleId: value.slice(2), prefix: bundle?.prefix ?? null },
        });
      } else
        await api(`${APPS_URL}/${app.id}`, {
          method: "PUT",
          body: { prefix: value.slice(2) },
        });
      await Promise.all([refreshPosthog(), mutate(APPS_URL)]);
      toast.success(
        value === "none" ? `${app.name} unmapped` : `${app.name} mapped`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save mapping");
    } finally {
      setBusy(false);
    }
  }

  if (error)
    return (
      <p className="caption-style text-danger leading-[1.4]">{error.message}</p>
    );
  if (!data)
    return (
      <p className="caption-style text-subtle">
        Looking for apps in your PostHog project…
      </p>
    );
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="caption-style text-subtle">
          {data.bundles.length} bundle ids and {data.prefixes.length} event
          prefixes seen in the last 30 days ·{" "}
          {data.cached ? `cached ${timeAgo(data.fetchedAt)}` : "just now"}
        </p>
        <Button
          variant="secondary"
          size="sm"
          onClick={rediscover}
          disabled={busy}
        >
          <RefreshCw
            aria-hidden
            className={cn("size-3.5", busy && "animate-spin")}
          />
          Rescan
        </Button>
      </div>
      {data.apps.length ? (
        <ul className="divide-line-strong divide-y">
          {data.apps.map((app) => (
            <AppRow
              key={app.id}
              app={app}
              data={data}
              onChange={change}
              busy={busy || !canManage}
            />
          ))}
        </ul>
      ) : (
        <p className="text-subtle">
          Add your own apps in Open ASO first, then map each one to its PostHog
          events here.
        </p>
      )}
      {(data.bundles.length > 0 || data.prefixes.length > 0) && (
        <div className="border-line-strong overflow-hidden rounded-lg border">
          <div className="bg-secondary border-line-strong caption-style text-soft border-b px-3 py-2">
            In this PostHog project
          </div>
          <ul className="divide-line-strong max-h-[240px] divide-y overflow-y-auto">
            {data.bundles.map((b) => (
              <li
                key={`b-${b.bundleId}`}
                className="caption-style flex items-center justify-between gap-3 px-3 py-2"
              >
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="text-foreground truncate font-mono">
                    {b.bundleId}
                  </span>
                  <span className="text-subtle truncate">
                    {[b.appName, b.prefix ? `prefix ${b.prefix}.` : null]
                      .filter(Boolean)
                      .join(" · ") || "bundle id"}
                  </span>
                </span>
                <span className="text-soft shrink-0 tabular-nums">
                  {formatCompact(b.events)} events · {formatCompact(b.users)}{" "}
                  people · {timeAgo(b.lastSeen)}
                </span>
              </li>
            ))}
            {data.prefixes
              .filter((p) => !data.bundles.some((b) => b.prefix === p.prefix))
              .map((p) => (
                <li
                  key={`p-${p.prefix}`}
                  className="caption-style flex items-center justify-between gap-3 px-3 py-2"
                >
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="text-foreground truncate font-mono">
                      {p.prefix}.*
                    </span>
                    <span className="text-subtle truncate">
                      {p.bundleId
                        ? `seen with ${p.bundleId}`
                        : "no $app_namespace"}
                    </span>
                  </span>
                  <span className="text-soft shrink-0 tabular-nums">
                    {formatCompact(p.events)} events · {formatCompact(p.users)}{" "}
                    people · {timeAgo(p.lastSeen)}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}
