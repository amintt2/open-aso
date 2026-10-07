"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Heart, Lightbulb, Loader2, RefreshCw, Trophy, X } from "lucide-react";
import Button from "@/components/_ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/_ui/sheet";
import { LabelTag, PositionBadge, ScoreBar } from "@/components/shell/score";
import { api, useApi } from "@/lib/client/api";
import { formatCompact, timeAgo } from "@/lib/client/format";
import type {
  KeywordAnalysis,
  TrackedApp,
  TrackedKeyword,
} from "@/lib/client/types";
import { COUNTRY_BY_CODE } from "@/lib/appstore/countries";
import { monthlySearches } from "@/lib/aso/scoring";
import { keywordInsight, metadataMatch } from "@/lib/keywords/table";
import { cn } from "@/lib/utils";
import KeywordTrendChart, {
  type HistoryPoint,
  type VersionMarker,
} from "./keyword-trend-chart";

type Props = {
  app: TrackedApp;
  keyword: TrackedKeyword | undefined;
  refreshing: boolean;
  onClose: () => void;
  onLike: (ids: number[], liked: boolean) => void;
  onRefresh: (ids: number[]) => void;
  onTopApps: (id: number) => void;
  onNotesSaved: (id: number, notes: string | null) => void;
};

export default function KeywordDetailSheet({
  keyword,
  onClose,
  ...rest
}: Props) {
  return (
    <Sheet open={!!keyword} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[620px]">
        {keyword && <DetailBody key={keyword.id} keyword={keyword} {...rest} />}
      </SheetContent>
    </Sheet>
  );
}

function Metric({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div
      className="bg-card flex flex-col gap-2.5 rounded-lg px-3 py-3"
      title={hint}
    >
      <span className="caption-style text-subtle">{label}</span>
      <span className="text-[14px] leading-none tabular-nums">{children}</span>
    </div>
  );
}

function BreakdownBar({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | undefined;
  hint: string;
}) {
  return (
    <div className="flex flex-col gap-2" title={hint}>
      <div className="caption-style flex justify-between">
        <span className="text-soft">{label}</span>
        <span className="text-subtle tabular-nums">{value ?? "—"}</span>
      </div>
      <span className="bg-track block h-1.5 overflow-hidden rounded-full">
        {value == null ? (
          <span className="bg-muted block h-full w-1/2 animate-pulse rounded-full" />
        ) : (
          <span
            className="bg-soft block h-full rounded-full transition-[width] duration-300"
            style={{ width: `${Math.max(3, value)}%` }}
          />
        )}
      </span>
    </div>
  );
}

function DetailBody({
  app,
  keyword: k,
  refreshing,
  onLike,
  onRefresh,
  onTopApps,
  onNotesSaved,
}: Omit<Props, "keyword" | "onClose"> & { keyword: TrackedKeyword }) {
  const country = COUNTRY_BY_CODE.get(k.country);
  const { data: history, isLoading: historyLoading } = useApi<{
    history: HistoryPoint[];
    versions: VersionMarker[];
  }>(`/api/keywords/${k.id}/history`);
  const { data: analysis, error: analysisError } = useApi<KeywordAnalysis>(
    `/api/analyze?term=${encodeURIComponent(k.term)}&country=${k.country}&trackId=${app.trackId}`,
    { dedupingInterval: 10 * 60 * 1000 },
  );
  const inTitle = metadataMatch(app.store.trackName ?? app.name, k.term);
  const inSubtitle = metadataMatch(app.subtitle, k.term);

  return (
    <>
      <SheetHeader className="h-auto min-h-14 py-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <SheetTitle className="truncate text-[16px] font-medium">
            {k.term}
          </SheetTitle>
          <SheetDescription className="text-subtle">
            {country
              ? `${country.flag} ${country.name}`
              : k.country.toUpperCase()}{" "}
            · updated {timeAgo(k.lastRefreshedAt)}
          </SheetDescription>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-pressed={k.liked}
            aria-label={k.liked ? "Unlike keyword" : "Like keyword"}
            onClick={() => onLike([k.id], !k.liked)}
          >
            <Heart
              aria-hidden
              className={cn("size-4", k.liked && "fill-danger text-danger")}
            />
          </Button>
          <SheetClose asChild>
            <Button variant="ghost" size="icon" aria-label="Close">
              <X aria-hidden className="size-4" />
            </Button>
          </SheetClose>
        </div>
      </SheetHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
        <div className="flex items-start gap-2.5 rounded-lg border border-(--tag-purple-border) bg-(--tag-purple-bg) px-3 py-3">
          <Lightbulb
            aria-hidden
            className="mt-px size-4 shrink-0 text-(--tag-purple-text)"
          />
          <p className="text-[13px] leading-[1.4] text-(--tag-purple-text)">
            {keywordInsight(k, inTitle, inSubtitle)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric label="Popularity">
            <ScoreBar value={k.popularity} />
          </Metric>
          <Metric label="Difficulty">
            <ScoreBar value={k.difficulty} invert />
          </Metric>
          <Metric
            label="Opportunity"
            hint="Balance of popularity and ease of ranking"
          >
            <ScoreBar value={k.opportunity} />
          </Metric>
          <Metric label="Position">
            {k.popularity == null ? (
              <span className="text-subtle">—</span>
            ) : (
              <PositionBadge position={k.position} change={k.positionChange} />
            )}
          </Metric>
          <Metric
            label="Est. searches/mo"
            hint="Modeled from popularity and market size"
          >
            {k.popularity == null
              ? "—"
              : formatCompact(monthlySearches(k.popularity, k.country))}
          </Metric>
          <Metric
            label="Est. downloads/mo"
            hint="Modeled downloads at your current position"
          >
            {formatCompact(k.downloadsEst)}
          </Metric>
          <Metric label="Results">{k.resultsCount ?? "—"}</Metric>
          <Metric label="Targeting">
            <LabelTag label={k.label} />
          </Metric>
        </div>

        <section
          aria-label="Difficulty breakdown"
          className="flex flex-col gap-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="lead-style font-medium">Difficulty breakdown</h3>
            {!analysis && !analysisError && (
              <Loader2
                aria-label="Analyzing"
                className="text-subtle size-3.5 animate-spin"
              />
            )}
            {analysisError && (
              <span className="caption-style text-danger">
                Live analysis unavailable
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <BreakdownBar
              label="App strength"
              value={analysis?.difficultyBreakdown.strength}
              hint="Ratings volume, rating and update freshness of the top 10 apps"
            />
            <BreakdownBar
              label="Relevance"
              value={analysis?.difficultyBreakdown.relevance}
              hint="How closely the top 10 titles match this keyword"
            />
            <BreakdownBar
              label="Saturation"
              value={analysis?.difficultyBreakdown.saturation}
              hint="How many apps compete for this search"
            />
          </div>
        </section>

        <KeywordTrendChart
          history={history?.history}
          versions={history?.versions}
          loading={historyLoading}
        />

        <NotesEditor keyword={k} onSaved={onNotesSaved} />
      </div>

      <SheetFooter>
        <Button
          variant="secondary"
          size="md"
          onClick={() => onTopApps(k.id)}
          disabled={!k.topApps.length}
        >
          <Trophy aria-hidden className="size-3.5" />
          Top apps
        </Button>
        <Button
          variant="muted"
          size="md"
          onClick={() => onRefresh([k.id])}
          disabled={refreshing}
        >
          <RefreshCw
            aria-hidden
            className={cn("size-3.5", refreshing && "animate-spin")}
          />
          {refreshing ? "Refreshing…" : "Refresh"}
        </Button>
      </SheetFooter>
    </>
  );
}

type SaveState = "idle" | "saving" | "saved" | "error";

function NotesEditor({
  keyword,
  onSaved,
}: {
  keyword: TrackedKeyword;
  onSaved: (id: number, notes: string | null) => void;
}) {
  const [value, setValue] = useState(keyword.notes ?? "");
  const [state, setState] = useState<SaveState>("idle");
  const saved = useRef(keyword.notes ?? "");
  const latest = useRef({ value, id: keyword.id, onSaved });

  useEffect(() => {
    latest.current = { value, id: keyword.id, onSaved };
  });

  const persist = useCallback(async () => {
    const { value: next, id, onSaved: done } = latest.current;
    if (next === saved.current) return;
    const notes = next.trim() ? next : null;
    const previous = saved.current;
    saved.current = next;
    setState("saving");
    try {
      await api(`/api/keywords/${id}`, { method: "PATCH", body: { notes } });
      done(id, notes);
      setState("saved");
    } catch {
      saved.current = previous;
      setState("error");
    }
  }, []);

  useEffect(() => {
    if (value === saved.current) return;
    const timer = setTimeout(() => void persist(), 700);
    return () => clearTimeout(timer);
  }, [value, persist]);

  useEffect(() => () => void persist(), [persist]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label
          htmlFor={`kw-notes-${keyword.id}`}
          className="lead-style font-medium"
        >
          Notes
        </label>
        <span
          aria-live="polite"
          className={cn(
            "caption-style",
            state === "error" ? "text-danger" : "text-subtle",
          )}
        >
          {state === "saving"
            ? "Saving…"
            : state === "saved"
              ? "Saved"
              : state === "error"
                ? "Could not save"
                : ""}
        </span>
      </div>
      <textarea
        id={`kw-notes-${keyword.id}`}
        value={value}
        maxLength={2000}
        onChange={(e) => setValue(e.target.value)}
        rows={4}
        placeholder="Ideas, variations, where you use this keyword…"
        className="border-line-strong bg-secondary placeholder:text-subtle focus-visible:border-ring w-full resize-y rounded-lg border px-3 py-2.5 text-[14px] leading-[1.4] transition-[border-color] duration-150 outline-none"
      />
    </div>
  );
}
