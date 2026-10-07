"use client";

import { useState } from "react";
import { Check, ExternalLink, Loader2, Star, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import Button, { buttonVariants } from "@/components/_ui/button";
import Tag from "@/components/_ui/tag";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/_ui/sheet";
import AppIcon from "@/components/shell/app-icon";
import { api, revalidate } from "@/lib/client/api";
import { formatCompact, formatUsd, timeAgo } from "@/lib/client/format";
import type { TopApp, TrackedApp, TrackedKeyword } from "@/lib/client/types";
import { cn } from "@/lib/utils";

type Props = {
  app: TrackedApp;
  keyword: TrackedKeyword | undefined;
  onClose: () => void;
};

export default function TopAppsSheet({ app, keyword, onClose }: Props) {
  return (
    <Sheet open={!!keyword} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[640px]">
        {keyword && (
          <>
            <SheetHeader className="h-auto min-h-14 py-3">
              <div className="flex min-w-0 flex-col gap-1.5">
                <SheetTitle className="truncate">
                  Top apps for “{keyword.term}”
                </SheetTitle>
                <SheetDescription className="text-subtle">
                  {keyword.country.toUpperCase()} · {keyword.resultsCount ?? 0}{" "}
                  results · updated {timeAgo(keyword.lastRefreshedAt)} ·
                  downloads and revenue are estimates
                </SheetDescription>
              </div>
              <SheetClose asChild>
                <Button variant="ghost" size="icon" aria-label="Close">
                  <X aria-hidden className="size-4" />
                </Button>
              </SheetClose>
            </SheetHeader>
            <ol
              className="divide-border flex min-h-0 flex-1 flex-col divide-y overflow-y-auto"
              aria-label="Top ranking apps"
            >
              {keyword.topApps.map((top) => (
                <TopAppRow
                  key={top.trackId}
                  top={top}
                  appId={app.id}
                  mine={top.trackId === app.trackId}
                  country={keyword.country}
                />
              ))}
              {!keyword.topApps.length && (
                <li className="text-subtle px-6 py-10 text-center">
                  No results stored yet. Refresh the keyword to fetch the top
                  apps.
                </li>
              )}
            </ol>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function matchTag(match: number) {
  if (match >= 1)
    return (
      <Tag tone="green" size="sm" className="text-[11px]">
        Title match
      </Tag>
    );
  if (match > 0)
    return (
      <Tag tone="yellow" size="sm" className="text-[11px]">
        Partial match
      </Tag>
    );
  return null;
}

function TopAppRow({
  top,
  appId,
  mine,
  country,
}: {
  top: TopApp;
  appId: number;
  mine: boolean;
  country: string;
}) {
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  async function addCompetitor() {
    setAdding(true);
    try {
      await api(`/api/apps/${appId}/competitors`, {
        method: "POST",
        body: { trackId: top.trackId, country },
      });
      setAdded(true);
      void revalidate(`/api/apps/${appId}/competitors`);
      toast.success(`${top.name} added to competitors`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add competitor");
    } finally {
      setAdding(false);
    }
  }

  return (
    <li
      className={cn(
        "flex items-center gap-3 px-6 py-3",
        mine && "bg-(--tag-purple-bg)",
      )}
      aria-current={mine ? "true" : undefined}
    >
      <span className="caption-style text-subtle w-5 shrink-0 text-right tabular-nums">
        {top.position}
      </span>
      <AppIcon src={top.iconUrl} name={top.name} className="size-10" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[14px]">{top.name}</span>
          {mine && (
            <Tag tone="purple" size="sm" className="text-[11px]">
              Your app
            </Tag>
          )}
          {matchTag(top.titleMatch)}
        </div>
        <span className="caption-style text-subtle flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
          <span className="truncate">{top.developer}</span>·
          <span className="inline-flex items-center gap-0.5">
            <Star aria-hidden className="size-3" />
            {top.rating.toFixed(1)} ({formatCompact(top.ratingCount)})
          </span>
          · updated {timeAgo(top.updatedAt)}
        </span>
        <span className="caption-style text-soft tabular-nums">
          Est. {formatCompact(top.downloadsEst)} downloads/mo · Est.{" "}
          {formatUsd(top.mrrEst)} MRR
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <a
          href={`https://apps.apple.com/app/id${top.trackId}`}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open ${top.name} in the App Store`}
          title="Open in App Store"
          className={buttonVariants({ variant: "ghost", size: "icon" })}
        >
          <ExternalLink aria-hidden className="size-3.5" />
        </a>
        {!mine && (
          <Button
            variant="secondary"
            size="icon"
            disabled={adding || added}
            onClick={addCompetitor}
            aria-label={
              added
                ? `${top.name} added as competitor`
                : `Add ${top.name} as competitor`
            }
            title="Add as competitor"
          >
            {adding ? (
              <Loader2 aria-hidden className="size-3.5 animate-spin" />
            ) : added ? (
              <Check aria-hidden className="text-trend size-3.5" />
            ) : (
              <UserPlus aria-hidden className="size-3.5" />
            )}
          </Button>
        )}
      </div>
    </li>
  );
}
