"use client";

import { useEffect, useRef, type ReactNode } from "react";
import {
  Copy,
  Download,
  Heart,
  HeartOff,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import Button from "@/components/_ui/button";
import { Input } from "@/components/_ui/input";
import type { TrackedKeyword } from "@/lib/client/types";
import type { Filters } from "@/lib/keywords/table";
import KeywordFilters from "./keyword-filters";
import type { RefreshProgress } from "./use-refresh-queue";

type Props = {
  query: string;
  onQuery: (q: string) => void;
  filters: Filters;
  onFilters: (f: Filters) => void;
  shown: number;
  total: number;
  progress: RefreshProgress | null;
  selected: TrackedKeyword[];
  onClearSelection: () => void;
  onRefresh: () => void;
  onLike: (liked: boolean) => void;
  onCopy: () => void;
  onExport: () => void;
  onDelete: () => void;
  extraFilters?: ReactNode;
  unit?: string;
};

export default function KeywordToolbar({
  query,
  onQuery,
  filters,
  onFilters,
  shown,
  total,
  progress,
  selected,
  extraFilters,
  unit = "keywords",
  ...bulk
}: Props) {
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="border-border flex min-h-[50px] shrink-0 flex-wrap items-center gap-2 border-b px-4 py-2">
      <div className="relative w-full sm:w-[240px]">
        <Search
          aria-hidden
          className="text-subtle pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
        />
        <Input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          onKeyDown={(e) =>
            e.key === "Escape" && (onQuery(""), e.currentTarget.blur())
          }
          placeholder="Search keywords"
          aria-label="Search keywords"
          aria-keyshortcuts="Meta+K Control+K"
          className="h-[30px] rounded-full pr-12 pl-8 text-[13px]"
        />
        <kbd className="caption-style text-subtle border-line-strong pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 rounded border px-1.5 py-0.5 font-sans sm:block">
          ⌘K
        </kbd>
      </div>
      <KeywordFilters value={filters} onChange={onFilters} />
      {extraFilters}
      {selected.length > 0 ? (
        <BulkBar selected={selected} {...bulk} />
      ) : (
        <div className="caption-style text-subtle ml-auto flex items-center gap-3">
          {progress && (
            <span
              className="text-soft inline-flex items-center gap-1.5"
              aria-live="polite"
            >
              <Loader2 aria-hidden className="size-3 animate-spin" />
              Analyzing · {progress.done}/{progress.total} done
            </span>
          )}
          {total > 0 && (
            <span className="hidden tabular-nums sm:inline">
              {shown === total
                ? `${total} ${unit}`
                : `${shown} of ${total} ${unit}`}
            </span>
          )}
          <span className="hidden lg:inline">
            Downloads and MRR are estimates
          </span>
        </div>
      )}
    </div>
  );
}

function BulkBar({
  selected,
  onClearSelection,
  onRefresh,
  onLike,
  onCopy,
  onExport,
  onDelete,
}: Omit<
  Props,
  | "query"
  | "onQuery"
  | "filters"
  | "onFilters"
  | "shown"
  | "total"
  | "progress"
  | "extraFilters"
  | "unit"
>) {
  const allLiked = selected.every((k) => k.liked);
  return (
    <div
      role="toolbar"
      aria-label="Bulk actions"
      className="border-line-strong flex flex-wrap items-center gap-1.5 sm:ml-auto sm:border-l sm:pl-3"
    >
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Clear selection"
        onClick={onClearSelection}
      >
        <X aria-hidden className="size-3.5" />
      </Button>
      <span className="caption-style text-foreground mr-2 tabular-nums">
        {selected.length} selected
      </span>
      <Button
        variant="secondary"
        size="sm"
        className="h-[30px]"
        onClick={onRefresh}
      >
        <RefreshCw aria-hidden className="size-3.5" />
        Refresh
      </Button>
      <Button
        variant="secondary"
        size="sm"
        className="h-[30px]"
        onClick={() => onLike(!allLiked)}
      >
        {allLiked ? (
          <HeartOff aria-hidden className="size-3.5" />
        ) : (
          <Heart aria-hidden className="size-3.5" />
        )}
        {allLiked ? "Unlike" : "Like"}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        className="h-[30px]"
        onClick={onCopy}
      >
        <Copy aria-hidden className="size-3.5" />
        Copy
      </Button>
      <Button
        variant="secondary"
        size="sm"
        className="h-[30px]"
        onClick={onExport}
      >
        <Download aria-hidden className="size-3.5" />
        Export
      </Button>
      <Button
        variant="secondary"
        size="sm"
        className="text-danger h-[30px]"
        onClick={onDelete}
      >
        <Trash2 aria-hidden className="size-3.5" />
        Delete
      </Button>
    </div>
  );
}
