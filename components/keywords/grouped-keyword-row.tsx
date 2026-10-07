"use client";

import { memo, type KeyboardEvent, type MouseEvent } from "react";
import { ChevronRight, Copy, Heart, HeartOff, Loader2, MoreHorizontal, RefreshCw, StickyNote, Trash2 } from "lucide-react";
import Button from "@/components/_ui/button";
import { Checkbox } from "@/components/_ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/_ui/dropdown-menu";
import { TableCell, TableRow } from "@/components/_ui/table";
import { RelevanceCell } from "@/components/shell/relevance";
import { LabelTag, PositionBadge, ScoreBar } from "@/components/shell/score";
import { COUNTRY_BY_CODE } from "@/lib/appstore/countries";
import { formatCompact, timeAgo } from "@/lib/client/format";
import type { TrackedKeyword } from "@/lib/client/types";
import { isStale, parseDate, STALE_HOURS, type KeywordGroup } from "@/lib/keywords/table";
import { cn } from "@/lib/utils";
import { DropdownRowItems, RowContextMenu } from "./keyword-row-menu";
import { STICKY_CELL, type RowHandlers } from "./keyword-row";

export type GroupHandlers = RowHandlers & {
  onToggle: (term: string) => void;
  onSelectGroup: (group: KeywordGroup, checked: boolean, shift: boolean) => void;
};

const ROW = "cursor-default outline-none hover:bg-[#1b1b1b] focus-visible:bg-[#1b1b1b] data-[selected=true]:bg-[#1c1a29]";
const MAX_FLAGS = 5;

function isInteractive(target: EventTarget) {
  return target instanceof Element && !!target.closest("button, a, input, textarea, [role=checkbox], [role=menuitem]");
}

function countryName(code: string) {
  return COUNTRY_BY_CODE.get(code)?.name ?? code.toUpperCase();
}

function flagOf(code: string) {
  return COUNTRY_BY_CODE.get(code)?.flag ?? code.toUpperCase();
}

function SourceBadge({ keyword }: { keyword: TrackedKeyword | null }) {
  if (!keyword || keyword.popularity == null) return null;
  const apple = keyword.popularitySource === "apple";
  return (
    <span
      title={apple ? "Apple Search Ads popularity" : "Estimated from App Store search suggestions"}
      className={apple ? "caption-style text-trend" : "caption-style text-faint"}
    >
      {apple ? "Apple" : "Est."}
    </span>
  );
}

function groupStale(g: KeywordGroup) {
  return !g.lastRefreshedAt || Date.now() - parseDate(g.lastRefreshedAt) > STALE_HOURS * 3600000;
}

type GroupRowProps = {
  group: KeywordGroup;
  expanded: boolean;
  selectedCount: number;
  refreshingCount: number;
  handlers: GroupHandlers;
};

function GroupRowBase({ group: g, expanded, selectedCount, refreshingCount, handlers }: GroupRowProps) {
  const checked = selectedCount === 0 ? false : selectedCount === g.ids.length ? true : "indeterminate";
  const names = g.countries.map(countryName);
  const best = g.bestPosition;

  function onKeyDown(e: KeyboardEvent<HTMLTableRowElement>) {
    if (e.target !== e.currentTarget) return;
    const toggle = e.key === "Enter" || (e.key === "ArrowRight" && !expanded) || (e.key === "ArrowLeft" && expanded);
    if (toggle) handlers.onToggle(g.term);
    else if (e.key === " ") {
      e.preventDefault();
      handlers.onSelectGroup(g, checked !== true, e.shiftKey);
    }
  }

  return (
    <TableRow
      tabIndex={0}
      aria-selected={checked === true}
      data-selected={checked === true}
      onClick={(e: MouseEvent) => !isInteractive(e.target) && handlers.onToggle(g.term)}
      onKeyDown={onKeyDown}
      className={cn("bg-background", ROW)}
    >
      <TableCell className={cn(STICKY_CELL, "left-0 w-10 pr-0 pl-4")}>
        <Checkbox
          aria-label={`Select ${g.term} in ${g.countries.length === 1 ? "1 country" : `${g.countries.length} countries`}`}
          checked={checked}
          onClick={(e) => {
            e.preventDefault();
            handlers.onSelectGroup(g, checked !== true, e.shiftKey);
          }}
        />
      </TableCell>
      <TableCell className={cn(STICKY_CELL, "border-border left-10 max-w-[280px] min-w-[180px] border-r pl-2")}>
        <div className="flex min-w-0 items-center gap-1.5">
          <button
            type="button"
            aria-label={expanded ? `Collapse ${g.term}` : `Expand ${g.term}`}
            aria-expanded={expanded}
            onClick={() => handlers.onToggle(g.term)}
            className="text-subtle hover:text-foreground focus-visible:ring-ring/60 flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors duration-150 outline-none focus-visible:ring-2"
          >
            <ChevronRight aria-hidden className={cn("size-3.5 transition-transform duration-150", expanded && "rotate-90")} />
          </button>
          <span className="min-w-0 truncate">{g.term}</span>
          {g.liked && (
            <span aria-label="Liked in at least one country" title="Liked in at least one country" className="text-danger shrink-0">
              <Heart aria-hidden className="size-3 fill-current" />
            </span>
          )}
          {g.notes && (
            <span title={g.notes} aria-label="Has notes" className="text-subtle shrink-0">
              <StickyNote aria-hidden className="size-3" />
            </span>
          )}
          {refreshingCount > 0 && <Loader2 aria-label="Refreshing" className="text-subtle size-3.5 shrink-0 animate-spin" />}
        </div>
      </TableCell>
      <TableCell>
        <span className="inline-flex items-center gap-2" title={names.join(", ")}>
          <span aria-hidden className="inline-flex gap-0.5 text-[14px] leading-none">
            {g.countries.slice(0, MAX_FLAGS).map((c) => (
              <span key={c}>{flagOf(c)}</span>
            ))}
          </span>
          {g.countries.length > MAX_FLAGS && (
            <span aria-hidden className="caption-style text-subtle">
              +{g.countries.length - MAX_FLAGS}
            </span>
          )}
          <span className="caption-style text-soft tabular-nums">
            <span aria-hidden>{g.countries.length}</span>
            <span className="sr-only">
              {g.countries.length} {g.countries.length === 1 ? "country" : "countries"}: {names.join(", ")}
            </span>
          </span>
        </span>
      </TableCell>
      <TableCell>
        <RelevanceCell
          relevance={g.bestRelevance?.relevance}
          category={g.bestRelevance?.relevanceCategory}
          source={g.bestRelevance?.relevanceSource}
          languageMatch={g.bestRelevance?.languageMatch}
        />
      </TableCell>
      <TableCell>
        {g.pending ? (
          <span className="text-subtle">—</span>
        ) : best ? (
          <span className="inline-flex items-center gap-1.5" title={`Best in ${countryName(best.country)}`}>
            <PositionBadge position={best.position} />
            <span aria-label={`in ${countryName(best.country)}`}>{flagOf(best.country)}</span>
          </span>
        ) : (
          <PositionBadge position={null} />
        )}
      </TableCell>
      <TableCell>
        <span className="inline-flex items-center gap-1.5">
          <ScoreBar value={g.popularity} />
          <SourceBadge keyword={g.bestPopularity} />
        </span>
      </TableCell>
      <TableCell>
        <ScoreBar value={g.difficulty} invert />
      </TableCell>
      <TableCell>
        {g.pending ? (
          <span className="caption-style text-subtle">{refreshingCount ? "Analyzing…" : "Pending"}</span>
        ) : (
          <LabelTag label={g.label} />
        )}
      </TableCell>
      <TableCell className="text-right tabular-nums">{formatCompact(g.downloadsEst)}</TableCell>
      <TableCell className={cn("caption-style", groupStale(g) ? "text-warning" : "text-subtle")}>{timeAgo(g.lastRefreshedAt)}</TableCell>
      <TableCell className="w-10 pr-3 pl-0 text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${g.term}`}>
              <MoreHorizontal aria-hidden className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[210px]">
            <DropdownMenuItem onSelect={() => handlers.onRefresh(g.ids)} disabled={refreshingCount === g.ids.length}>
              <RefreshCw aria-hidden className="size-3.5" /> Refresh all countries
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => handlers.onCopy([g.term])}>
              <Copy aria-hidden className="size-3.5" /> Copy keyword
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => handlers.onLike(g.ids, !g.rows.every((k) => k.liked))}>
              {g.rows.every((k) => k.liked) ? <HeartOff aria-hidden className="size-3.5" /> : <Heart aria-hidden className="size-3.5" />}
              {g.rows.every((k) => k.liked) ? "Unlike everywhere" : "Like everywhere"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => handlers.onDelete(g.ids)} className="text-danger">
              <Trash2 aria-hidden className="size-3.5" /> Delete in {g.ids.length === 1 ? "1 country" : `${g.ids.length} countries`}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

export const GroupRow = memo(GroupRowBase);

type SubRowProps = {
  keyword: TrackedKeyword;
  selected: boolean;
  refreshing: boolean;
  handlers: RowHandlers;
};

function SubRowBase({ keyword: k, selected, refreshing, handlers }: SubRowProps) {
  const pending = k.popularity == null;
  const name = countryName(k.country);

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
        aria-label={`${k.term} in ${name}`}
        data-selected={selected}
        onClick={(e: MouseEvent) => !isInteractive(e.target) && handlers.onOpen(k.id)}
        onKeyDown={onKeyDown}
        className={cn("bg-card", ROW)}
      >
        <TableCell className={cn(STICKY_CELL, "left-0 w-10 pr-0 pl-4")}>
          <Checkbox
            aria-label={`Select ${k.term} in ${name}`}
            checked={selected}
            onClick={(e) => {
              e.preventDefault();
              handlers.onSelect(k.id, !selected, e.shiftKey);
            }}
          />
        </TableCell>
        <TableCell className={cn(STICKY_CELL, "border-border left-10 max-w-[280px] min-w-[180px] border-r pl-2")}>
          <div className="flex min-w-0 items-center gap-1.5 pl-[30px]">
            <span aria-hidden className="shrink-0">
              {flagOf(k.country)}
            </span>
            <button
              type="button"
              onClick={() => handlers.onOpen(k.id)}
              className="text-soft min-w-0 cursor-pointer truncate text-left outline-none hover:underline focus-visible:underline"
            >
              {name}
            </button>
            {k.liked && (
              <span aria-label="Liked" className="text-danger shrink-0">
                <Heart aria-hidden className="size-3 fill-current" />
              </span>
            )}
            {k.notes && (
              <span title={k.notes} aria-label="Has notes" className="text-subtle shrink-0">
                <StickyNote aria-hidden className="size-3" />
              </span>
            )}
            {refreshing && <Loader2 aria-label="Refreshing" className="text-subtle size-3.5 shrink-0 animate-spin" />}
          </div>
        </TableCell>
        <TableCell className="caption-style text-subtle">{k.country.toUpperCase()}</TableCell>
        <TableCell>
          <RelevanceCell relevance={k.relevance} category={k.relevanceCategory} source={k.relevanceSource} languageMatch={k.languageMatch} />
        </TableCell>
        <TableCell>{pending ? <span className="text-subtle">—</span> : <PositionBadge position={k.position} change={k.positionChange} />}</TableCell>
        <TableCell>
          <span className="inline-flex items-center gap-1.5">
            <ScoreBar value={k.popularity} />
            <SourceBadge keyword={k} />
          </span>
        </TableCell>
        <TableCell>
          <ScoreBar value={k.difficulty} invert />
        </TableCell>
        <TableCell>
          {pending ? <span className="caption-style text-subtle">{refreshing ? "Analyzing…" : "Pending"}</span> : <LabelTag label={k.label} />}
        </TableCell>
        <TableCell className="text-right tabular-nums">{formatCompact(k.downloadsEst)}</TableCell>
        <TableCell className={cn("caption-style", isStale(k) ? "text-warning" : "text-subtle")}>{timeAgo(k.lastRefreshedAt)}</TableCell>
        <TableCell className="w-10 pr-3 pl-0 text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${k.term} in ${name}`}>
                <MoreHorizontal aria-hidden className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[190px]">
              <DropdownRowItems keyword={k} refreshing={refreshing} handlers={handlers} />
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>
    </RowContextMenu>
  );
}

export const SubRow = memo(SubRowBase);
