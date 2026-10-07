"use client";

import { memo, type KeyboardEvent, type MouseEvent } from "react";
import { Heart, Loader2, MoreHorizontal, StickyNote } from "lucide-react";
import Button from "@/components/_ui/button";
import { Checkbox } from "@/components/_ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/_ui/dropdown-menu";
import { TableCell, TableRow } from "@/components/_ui/table";
import Sparkline from "@/components/_common/sparkline";
import { LabelTag, PositionBadge, ScoreBar } from "@/components/shell/score";
import { formatCompact, formatUsd, timeAgo } from "@/lib/client/format";
import type { TrackedKeyword } from "@/lib/client/types";
import { isStale, type MetadataMatch } from "@/lib/keywords/table";
import { cn } from "@/lib/utils";
import { DropdownRowItems, RowContextMenu } from "./keyword-row-menu";

export type RowHandlers = {
  onSelect: (id: number, checked: boolean, shift: boolean) => void;
  onOpen: (id: number) => void;
  onTopApps: (id: number) => void;
  onRefresh: (ids: number[]) => void;
  onLike: (ids: number[], liked: boolean) => void;
  onCopy: (terms: string[]) => void;
  onDelete: (ids: number[]) => void;
};

type RowProps = {
  keyword: TrackedKeyword;
  selected: boolean;
  refreshing: boolean;
  sparkline: (number | null)[] | undefined;
  inTitle: MetadataMatch;
  inSubtitle: MetadataMatch;
  handlers: RowHandlers;
};

export const STICKY_CELL = "sticky z-10 bg-inherit";

function MetaChip({
  letter,
  field,
  match,
}: {
  letter: string;
  field: string;
  match: MetadataMatch;
}) {
  const label =
    match === "full"
      ? `In ${field}`
      : match === "partial"
        ? `Partly in ${field}`
        : `Not in ${field}`;
  return (
    <span
      title={label}
      aria-label={label}
      className={cn(
        "caption-style inline-flex size-[18px] items-center justify-center rounded-[5px] border font-medium",
        match === "full" &&
          "border-(--tag-green-border) bg-(--tag-green-bg) text-(--tag-green-text)",
        match === "partial" &&
          "border-(--tag-yellow-border) bg-(--tag-yellow-bg) text-(--tag-yellow-text)",
        !match && "text-faint border-border",
      )}
    >
      {letter}
    </span>
  );
}

function isInteractive(target: EventTarget) {
  return (
    target instanceof Element &&
    !!target.closest(
      "button, a, input, textarea, [role=checkbox], [role=menuitem]",
    )
  );
}

function KeywordRow({
  keyword: k,
  selected,
  refreshing,
  sparkline,
  inTitle,
  inSubtitle,
  handlers,
}: RowProps) {
  const pending = k.popularity == null;

  function onKeyDown(e: KeyboardEvent<HTMLTableRowElement>) {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter") handlers.onOpen(k.id);
    else if (e.key === " ") {
      e.preventDefault();
      handlers.onSelect(k.id, !selected, e.shiftKey);
    }
  }

  return (
    <RowContextMenu keyword={k} refreshing={refreshing} handlers={handlers}>
      <TableRow
        tabIndex={0}
        aria-selected={selected}
        data-selected={selected}
        onDoubleClick={(e: MouseEvent) =>
          !isInteractive(e.target) && handlers.onOpen(k.id)
        }
        onKeyDown={onKeyDown}
        className="bg-background cursor-default outline-none hover:bg-[#1b1b1b] focus-visible:bg-[#1b1b1b] data-[selected=true]:bg-[#1c1a29]"
      >
        <TableCell className={cn(STICKY_CELL, "left-0 w-10 pr-0 pl-4")}>
          <Checkbox
            aria-label={`Select ${k.term}`}
            checked={selected}
            onClick={(e) => {
              e.preventDefault();
              handlers.onSelect(k.id, !selected, e.shiftKey);
            }}
          />
        </TableCell>
        <TableCell
          className={cn(
            STICKY_CELL,
            "border-border left-10 max-w-[280px] min-w-[180px] border-r pl-2",
          )}
        >
          <div className="flex min-w-0 items-center gap-1.5">
            <button
              type="button"
              aria-label={k.liked ? `Unlike ${k.term}` : `Like ${k.term}`}
              aria-pressed={k.liked}
              onClick={() => handlers.onLike([k.id], !k.liked)}
              className="text-faint hover:text-soft aria-pressed:text-danger focus-visible:ring-ring/60 flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors duration-150 outline-none focus-visible:ring-2"
            >
              <Heart
                aria-hidden
                className={cn("size-3.5", k.liked && "fill-current")}
              />
            </button>
            <button
              type="button"
              onClick={() => handlers.onOpen(k.id)}
              className="min-w-0 cursor-pointer truncate text-left outline-none hover:underline focus-visible:underline"
            >
              {k.term}
            </button>
            {k.notes && (
              <span
                title={k.notes}
                aria-label="Has notes"
                className="text-subtle shrink-0"
              >
                <StickyNote aria-hidden className="size-3" />
              </span>
            )}
            {refreshing && (
              <Loader2
                aria-label="Refreshing"
                className="text-subtle size-3.5 shrink-0 animate-spin"
              />
            )}
          </div>
        </TableCell>
        <TableCell>
          <ScoreBar value={k.popularity} />
        </TableCell>
        <TableCell>
          <ScoreBar value={k.difficulty} invert />
        </TableCell>
        <TableCell>
          {pending ? (
            <span className="caption-style text-subtle">
              {refreshing ? "Analyzing…" : "Pending"}
            </span>
          ) : (
            <LabelTag label={k.label} />
          )}
        </TableCell>
        <TableCell>
          {pending ? (
            <span className="text-subtle">—</span>
          ) : (
            <PositionBadge position={k.position} change={k.positionChange} />
          )}
        </TableCell>
        <TableCell>
          <Sparkline values={sparkline ?? []} invert />
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {formatCompact(k.downloadsEst)}
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {formatCompact(k.top5Downloads)}
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {formatUsd(k.top5Mrr)}
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {k.resultsCount ?? "—"}
        </TableCell>
        <TableCell>
          <span className="inline-flex gap-1">
            <MetaChip letter="T" field="title" match={inTitle} />
            <MetaChip letter="S" field="subtitle" match={inSubtitle} />
          </span>
        </TableCell>
        <TableCell
          className={cn(
            "caption-style",
            isStale(k) ? "text-warning" : "text-subtle",
          )}
        >
          {timeAgo(k.lastRefreshedAt)}
        </TableCell>
        <TableCell className="w-10 pr-3 pl-0 text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Actions for ${k.term}`}
              >
                <MoreHorizontal aria-hidden className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[190px]">
              <DropdownRowItems
                keyword={k}
                refreshing={refreshing}
                handlers={handlers}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>
    </RowContextMenu>
  );
}

export default memo(KeywordRow);
