"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Download,
  Archive,
  KeyRound,
  Loader2,
  MoreHorizontal,
  Plus,
  RefreshCw,
  SearchX,
  Sparkles,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import Button from "@/components/_ui/button";
import CountBadge from "@/components/_ui/count-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/_ui/dropdown-menu";
import CountrySelect from "@/components/shell/country-select";
import EmptyState from "@/components/shell/empty-state";
import PageHeader from "@/components/shell/page-header";
import { ALL_COUNTRIES, useAppCountry, useCurrentApp } from "@/hooks/use-app";
import { COUNTRY_BY_CODE } from "@/lib/appstore/countries";
import { api, revalidate, useApi } from "@/lib/client/api";
import type { TrackedKeyword } from "@/lib/client/types";
import type { PositionSeries } from "@/lib/keywords/history";
import type { TrackedRelevanceResult } from "@/lib/relevance/tracked";
import {
  countrySummaries,
  DEFAULT_FILTERS,
  defaultDir,
  defaultGroupDir,
  filterGroups,
  filterKeywords,
  groupKeywords,
  isStale,
  parseDate,
  sortGroups,
  sortKeywords,
  summarize,
  type Filters,
  type GroupSort,
  type GroupSortKey,
  type KeywordGroup,
  type Sort,
  type SortKey,
} from "@/lib/keywords/table";
import { slugify } from "@/lib/utils";
import AddKeywordsSheet from "./add-keywords-sheet";
import type { ArchivableKeyword } from "./archive-types";
import ArchivedView from "./archived-view";
import CleanupSheet from "./cleanup-sheet";
import CountryOverview from "./country-overview";
import DeleteKeywordsDialog from "./delete-keywords-dialog";
import DetectBanner, { DetectSummary } from "./detect-banner";
import FindMenu from "./find-menu";
import type { GroupHandlers } from "./grouped-keyword-row";
import GroupedKeywordTable from "./grouped-keyword-table";
import KeywordDetailSheet from "./keyword-detail-sheet";
import KeywordTable, { KeywordTableSkeleton } from "./keyword-table";
import KeywordSummary from "./keyword-summary";
import KeywordToolbar from "./keyword-toolbar";
import MinCountriesFilter from "./min-countries-filter";
import TopAppsSheet from "./top-apps-sheet";
import { useKeywordActions } from "./use-keyword-actions";
import { useKeywordDetect } from "./use-keyword-detect";
import { useRefreshQueue } from "./use-refresh-queue";

type Panel = { type: "detail" | "top"; id: number } | null;
type Layout = "keywords" | "countries";
type Cleanup = { country: string | null } | null;

const LAYOUTS: { value: Layout; label: string; title: string }[] = [
  { value: "keywords", label: "By keyword", title: "One row per keyword, with every country it is tracked in" },
  { value: "countries", label: "By country", title: "One row per country: tracked, ranked, in metadata and unused" },
];

const EMPTY = new Set<number>();
const NO_GROUPS: KeywordGroup[] = [];

export default function KeywordsView() {
  const initialQuery = useSearchParams().get("q") ?? "";
  const { appId, app, error: appError } = useCurrentApp();
  const [country, setCountry] = useAppCountry(app, { allowAll: true });
  const allMode = country === ALL_COUNTRIES;
  const homeCountry = app?.primaryCountry ?? "us";
  const listKey = app
    ? allMode
      ? `/api/apps/${appId}/keywords`
      : `/api/apps/${appId}/keywords?country=${country}`
    : null;
  const scoredRef = useRef<(k: TrackedKeyword) => boolean>(() => false);
  const {
    data: keywords,
    error,
    isLoading,
    mutate,
  } = useApi<TrackedKeyword[]>(listKey, {
    keepPreviousData: false,
    refreshInterval: (latest) =>
      latest?.some((k) => scoredRef.current(k)) ? 20000 : 0,
  });
  const { data: history } = useApi<PositionSeries>(
    app && !allMode
      ? `/api/keywords/history?appId=${appId}&country=${country}&days=30`
      : null,
  );

  const { data: archivedList, mutate: mutateArchived } = useApi<
    ArchivableKeyword[]
  >(
    app
      ? `/api/apps/${appId}/keywords?archived=only${allMode ? "" : `&country=${country}`}`
      : null,
  );
  const archived = useMemo(
    () => (archivedList ?? []).filter((k) => k.archivedAt),
    [archivedList],
  );
  const [showArchived, setShowArchived] = useState(false);

  const [query, setQuery] = useState(initialQuery);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [minCountries, setMinCountries] = useState(1);
  const [sort, setSort] = useState<Sort>({ key: "popularity", dir: "desc" });
  const [groupSort, setGroupSort] = useState<GroupSort>({
    key: "popularity",
    dir: "desc",
  });
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [selection, setSelection] = useState<{
    country: string;
    ids: ReadonlySet<number>;
  }>({ country, ids: EMPTY });
  const [panel, setPanel] = useState<Panel>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<number[]>([]);
  const [scoringRelevance, setScoringRelevance] = useState(false);
  const [layout, setLayout] = useState<Layout>("keywords");
  const [cleanup, setCleanup] = useState<Cleanup>(null);
  const [deleteNote, setDeleteNote] = useState<string | undefined>();
  const autoScored = useRef(new Set<string>());
  const lastClicked = useRef<number | null>(null);
  const lastGroup = useRef<string | null>(null);
  const autoQueued = useRef(new Set<number>());

  const selected = selection.country === country ? selection.ids : EMPTY;
  const setSelected = useCallback(
    (ids: ReadonlySet<number>) => setSelection({ country, ids }),
    [country],
  );

  const onBatch = useCallback(
    () => Promise.all([revalidate("/api/apps"), revalidate("/api/keywords/")]),
    [],
  );
  const { refreshing, progress, enqueue, busy } = useRefreshQueue(onBatch);
  const reloadKeywords = useCallback(() => {
    void mutate();
    void mutateArchived();
    void revalidate("/api/apps");
  }, [mutate, mutateArchived]);
  const detect = useKeywordDetect(
    app?.id,
    allMode ? homeCountry : country,
    reloadKeywords,
  );
  const actions = useKeywordActions(appId, mutate);

  const all = useMemo(() => keywords ?? [], [keywords]);
  const visible = useMemo(
    () =>
      allMode ? all : sortKeywords(filterKeywords(all, query, filters), sort),
    [all, allMode, query, filters, sort],
  );
  const groups = useMemo(
    () => (allMode ? groupKeywords(all) : NO_GROUPS),
    [all, allMode],
  );
  const visibleGroups = useMemo(
    () =>
      allMode
        ? sortGroups(filterGroups(groups, query, filters, minCountries), groupSort)
        : NO_GROUPS,
    [allMode, groups, query, filters, minCountries, groupSort],
  );
  const visibleRows = useMemo(
    () => (allMode ? visibleGroups.flatMap((g) => g.rows) : visible),
    [allMode, visibleGroups, visible],
  );
  const countryCount = useMemo(
    () => new Set(all.map((k) => k.country)).size,
    [all],
  );
  const byId = useMemo(() => new Map(all.map((k) => [k.id, k])), [all]);
  const summary = useMemo(() => summarize(country, all), [country, all]);
  const countries = useMemo(
    () => (allMode ? countrySummaries(all) : []),
    [all, allMode],
  );
  const byCountry = allMode && layout === "countries";

  const scoringFrom = detect.multiWindow?.from ?? null;
  const scoringTo = detect.multiWindow?.to ?? null;
  const scoredByServer = useCallback(
    (k: TrackedKeyword) => {
      if (!scoringFrom || k.lastRefreshedAt) return false;
      const created = parseDate(k.createdAt);
      return (
        created >= parseDate(scoringFrom) - 1000 &&
        (!scoringTo || created <= parseDate(scoringTo) + 1000)
      );
    },
    [scoringFrom, scoringTo],
  );

  useEffect(() => {
    scoredRef.current = scoredByServer;
  }, [scoredByServer]);

  useEffect(() => {
    const pending = all
      .filter(
        (k) =>
          !k.lastRefreshedAt &&
          !autoQueued.current.has(k.id) &&
          !scoredByServer(k),
      )
      .map((k) => k.id);
    if (!pending.length) return;
    pending.forEach((id) => autoQueued.current.add(id));
    enqueue(pending);
  }, [all, enqueue, scoredByServer]);

  const visibleRef = useRef<TrackedKeyword[]>(visible);
  const groupsRef = useRef(visibleGroups);
  const expandedRef = useRef(expanded);
  const selectedRef = useRef(selected);
  useEffect(() => {
    visibleRef.current = allMode
      ? visibleGroups.filter((g) => expanded.has(g.term)).flatMap((g) => g.rows)
      : visible;
    groupsRef.current = visibleGroups;
    expandedRef.current = expanded;
    selectedRef.current = selected;
  });

  const handlers = useMemo<GroupHandlers>(
    () => ({
      onSelect: (id, checked, shift) => {
        const next = new Set(selectedRef.current);
        const rows = visibleRef.current;
        const from =
          lastClicked.current == null
            ? -1
            : rows.findIndex((r) => r.id === lastClicked.current);
        const to = rows.findIndex((r) => r.id === id);
        const range =
          shift && from >= 0 && to >= 0
            ? rows
                .slice(Math.min(from, to), Math.max(from, to) + 1)
                .map((r) => r.id)
            : [id];
        range.forEach((rid) => (checked ? next.add(rid) : next.delete(rid)));
        lastClicked.current = id;
        setSelected(next);
      },
      onSelectGroup: (group, checked, shift) => {
        const next = new Set(selectedRef.current);
        const list = groupsRef.current;
        const from =
          lastGroup.current == null
            ? -1
            : list.findIndex((g) => g.term === lastGroup.current);
        const to = list.findIndex((g) => g.term === group.term);
        const range =
          shift && from >= 0 && to >= 0
            ? list.slice(Math.min(from, to), Math.max(from, to) + 1)
            : [group];
        range
          .flatMap((g) => g.ids)
          .forEach((rid) => (checked ? next.add(rid) : next.delete(rid)));
        lastGroup.current = group.term;
        setSelected(next);
      },
      onToggle: (term) => {
        const next = new Set(expandedRef.current);
        if (next.has(term)) next.delete(term);
        else next.add(term);
        setExpanded(next);
      },
      onOpen: (id) => setPanel({ type: "detail", id }),
      onTopApps: (id) => setPanel({ type: "top", id }),
      onRefresh: (ids) => void enqueue(ids),
      onLike: (ids, liked) => void actions.setLiked(ids, liked),
      onCopy: (terms) => void actions.copy(terms),
      onDelete: (ids) => {
        setDeleteNote(undefined);
        setPendingDelete(ids);
      },
    }),
    [actions, enqueue, setSelected],
  );

  function onSort(key: SortKey) {
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: defaultDir(key) },
    );
  }

  function onGroupSort(key: GroupSortKey) {
    setGroupSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: defaultGroupDir(key) },
    );
  }

  const scoreRelevance = useCallback(
    async (quiet: boolean) => {
      if (!app) return;
      setScoringRelevance(true);
      try {
        const res = await api<TrackedRelevanceResult>(
          `/api/apps/${app.id}/keywords/relevance`,
          { method: "POST", body: { country } },
        );
        await mutate();
        if (!quiet && res.jevError)
          toast.warning(
            `Relevance was estimated from your listing for some keywords: ${res.jevError}`,
          );
      } catch (e) {
        if (!quiet)
          toast.error(
            e instanceof Error ? e.message : "Could not score relevance",
          );
      } finally {
        setScoringRelevance(false);
      }
    },
    [app, country, mutate],
  );

  function updateData(everything: boolean) {
    const ids = (everything ? all : all.filter((k) => isStale(k))).map(
      (k) => k.id,
    );
    const unscored = all.some((k) => !k.relevanceAt);
    if (ids.length) enqueue(ids);
    if (everything || unscored) void scoreRelevance(false);
    if (!ids.length && !everything && !unscored)
      toast.success(
        "Everything is up to date. Data is re-checked once it is older than 20 hours.",
      );
  }

  const hasUnscored = all.some((k) => !k.relevanceAt && k.lastRefreshedAt);
  useEffect(() => {
    if (allMode || busy || scoringRelevance || !hasUnscored) return;
    if (autoScored.current.has(country)) return;
    autoScored.current.add(country);
    void scoreRelevance(true);
  }, [allMode, busy, scoringRelevance, hasUnscored, country, scoreRelevance]);

  function archiveAll(ids: number[], name: string) {
    setDeleteNote(
      `This archives every keyword tracked in ${name}, including liked ones and ones with notes.`,
    );
    setPendingDelete(ids);
  }

  function onCleaned(ids: number[]) {
    const gone = new Set(ids);
    setSelected(new Set([...selected].filter((id) => !gone.has(id))));
    if (panel && gone.has(panel.id)) setPanel(null);
    reloadKeywords();
  }

  function exportName(suffix = "") {
    return `${slugify(app?.name ?? "app")}-keywords-${country}${suffix}-${new Date().toISOString().slice(0, 10)}`;
  }

  async function confirmDelete() {
    const ids = pendingDelete;
    setPendingDelete([]);
    const gone = new Set(ids);
    setSelected(new Set([...selected].filter((id) => !gone.has(id))));
    if (panel && gone.has(panel.id)) setPanel(null);
    await actions.remove(ids);
    void mutateArchived();
  }

  function clearFilters() {
    setQuery("");
    setFilters(DEFAULT_FILTERS);
    setMinCountries(1);
  }

  const onNotesSaved = useCallback(
    (id: number, notes: string | null) =>
      void mutate(
        (list) => list?.map((k) => (k.id === id ? { ...k, notes } : k)),
        { revalidate: false },
      ),
    [mutate],
  );

  const countryName = allMode
    ? "any country"
    : (COUNTRY_BY_CODE.get(country)?.name ?? country.toUpperCase());
  const selectedRows = all.filter((k) => selected.has(k.id));
  const trackedCount = app
    ? new Set([app.primaryCountry, ...app.countries]).size
    : 1;
  const shownCount = allMode ? visibleGroups.length : visible.length;
  const staleCount = summary.stale;
  const updating = busy || scoringRelevance;

  if (appError)
    return (
      <>
        <PageHeader title="Keywords" />
        <EmptyState
          icon={AlertTriangle}
          title="App not found"
          description="This app may have been removed. Pick another app from the sidebar."
        />
      </>
    );

  return (
    <>
      <PageHeader
        title="Keywords"
        description="Which searches do I track, where do I rank, and is each one in my metadata?"
        badge={
          keywords &&
          (allMode ? (
            <CountBadge
              className="px-1.5"
              aria-label={`${groups.length} keywords in ${countryCount} countries`}
            >
              {groups.length} keywords · {countryCount}{" "}
              {countryCount === 1 ? "country" : "countries"}
            </CountBadge>
          ) : (
            <CountBadge aria-label={`${keywords.length} keywords`}>
              {keywords.length}
            </CountBadge>
          ))
        }
        actions={
          <>
            <CountrySelect
              value={country}
              onChange={setCountry}
              allOption={{ value: ALL_COUNTRIES, label: "All countries" }}
              className="max-w-[170px] min-w-[120px] sm:min-w-[150px]"
            />
            <FindMenu
              country={allMode ? homeCountry : country}
              trackedCount={trackedCount}
              running={detect.running}
              disabled={!app}
              onDetect={(scope) => void detect.start(scope)}
            />
            <Button
              variant="secondary"
              size="sm"
              className="h-[30px] px-3"
              onClick={() => updateData(false)}
              disabled={!all.length || updating}
              aria-label="Update data"
              title={
                staleCount
                  ? `Re-check popularity, difficulty, rank and relevance for the ${staleCount} keywords older than 20 hours`
                  : "Popularity, difficulty, rank and relevance are all less than 20 hours old"
              }
            >
              <RefreshCw
                aria-hidden
                className={updating ? "size-3.5 animate-spin" : "size-3.5"}
              />
              <span className="hidden md:inline">Update data</span>
              {staleCount > 0 && !updating && (
                <CountBadge>{staleCount}</CountBadge>
              )}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="h-[30px] px-3"
              onClick={() => setCleanup({ country: allMode ? null : country })}
              disabled={!all.length}
              aria-label="Clean up"
              title="Preview and archive unused keywords: not in your metadata and unranked for 14 days or more. Their rank history is kept."
            >
              <Sparkles aria-hidden className="size-3.5" />
              <span className="hidden md:inline">Clean up</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="h-[30px] px-3"
              onClick={() => setAddOpen(true)}
              disabled={!app}
              aria-label="Add keywords"
              title="Type or paste the search terms you want to track"
            >
              <Plus aria-hidden className="size-3.5" />
              <span className="hidden sm:inline">Add</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label="More keyword actions"
                  disabled={!app}
                >
                  <MoreHorizontal aria-hidden className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[250px]">
                <DropdownMenuItem
                  onSelect={() => actions.exportCsv(visibleRows, exportName())}
                  disabled={!visibleRows.length}
                >
                  <Download aria-hidden className="size-3.5" /> Export visible
                  keywords as CSV
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => updateData(true)}
                  disabled={!all.length || updating}
                >
                  <RefreshCw aria-hidden className="size-3.5" /> Update all{" "}
                  {all.length} now, even recent ones
                </DropdownMenuItem>
                {!allMode && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => archiveAll(summary.ids, countryName)}
                      disabled={!all.length}
                    >
                      <Archive aria-hidden className="size-3.5" /> Archive all
                      keywords in {countryName}…
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      >
        {busy && (
          <div
            className="relative h-px w-full overflow-visible"
            role="progressbar"
            aria-label="Analyzing keywords"
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-valuenow={progress.done}
          >
            <span
              className="bg-status absolute inset-y-0 left-0 h-0.5 -translate-y-px transition-[width] duration-500"
              style={{
                width: `${Math.max(4, (progress.done / Math.max(1, progress.total)) * 100)}%`,
              }}
            />
          </div>
        )}
      </PageHeader>

      {detect.job && <DetectBanner job={detect.job} multi={detect.multi} />}
      {!detect.job && detect.summary && (
        <DetectSummary
          result={detect.summary}
          onDismiss={detect.dismissSummary}
        />
      )}

      {app && keywords && (all.length > 0 || archived.length > 0) && (
        <KeywordSummary
          archived={archived.length}
          showArchived={showArchived}
          onShowArchived={setShowArchived}
          summary={summary}
          scope={
            allMode
              ? `${countryCount} ${countryCount === 1 ? "country" : "countries"}`
              : countryName
          }
          filters={filters}
          onFilters={(f) => {
            setFilters(f);
            setLayout("keywords");
            setShowArchived(false);
          }}
        />
      )}

      {showArchived && app ? (
        <ArchivedView
          appId={appId}
          rows={archived}
          showCountry={allMode}
          onChanged={reloadKeywords}
          onBack={() => setShowArchived(false)}
        />
      ) : (
        <>
      <KeywordToolbar
        query={query}
        onQuery={setQuery}
        filters={filters}
        onFilters={setFilters}
        extraFilters={
          allMode && (
            <>
              <MinCountriesFilter
                value={minCountries}
                max={countryCount}
                onChange={setMinCountries}
              />
              <div
                role="group"
                aria-label="Layout"
                className="border-line-strong flex h-[30px] items-center rounded-full border p-0.5"
              >
                {LAYOUTS.map((l) => (
                  <button
                    key={l.value}
                    type="button"
                    title={l.title}
                    aria-pressed={layout === l.value}
                    onClick={() => setLayout(l.value)}
                    className="caption-style text-subtle aria-pressed:bg-muted aria-pressed:text-foreground focus-visible:ring-ring/60 h-full cursor-pointer rounded-full px-2.5 transition-colors duration-150 outline-none hover:text-soft focus-visible:ring-2"
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </>
          )
        }
        shown={byCountry ? countries.length : shownCount}
        total={
          byCountry ? countries.length : allMode ? groups.length : all.length
        }
        unit={byCountry ? "countries" : "keywords"}
        progress={busy ? progress : null}
        selected={selectedRows}
        onClearSelection={() => setSelected(EMPTY)}
        onRefresh={() => enqueue(selectedRows.map((k) => k.id))}
        onLike={(liked) =>
          void actions.setLiked(
            selectedRows.map((k) => k.id),
            liked,
          )
        }
        onCopy={() =>
          void actions.copy([...new Set(selectedRows.map((k) => k.term))])
        }
        onExport={() =>
          actions.exportCsv(selectedRows, exportName("-selected"))
        }
        onDelete={() => {
          setDeleteNote(undefined);
          setPendingDelete(selectedRows.map((k) => k.id));
        }}
      />

      <div className="min-h-0 flex-1 overflow-auto">
        {error ? (
          <EmptyState
            icon={AlertTriangle}
            title="Could not load keywords"
            description={
              error instanceof Error ? error.message : "Unexpected error"
            }
            action={
              <Button
                variant="secondary"
                size="md"
                onClick={() => void mutate()}
              >
                Try again
              </Button>
            }
          />
        ) : !app || isLoading || !keywords ? (
          <KeywordTableSkeleton />
        ) : !all.length ? (
          <EmptyState
            icon={KeyRound}
            title={`No keywords tracked in ${countryName}`}
            description="Find keywords scans your metadata and the App Store for the terms this app is already indexed or ranked for. You can also add your own. Each keyword gets a popularity, a difficulty and a daily position."
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => void detect.start("country")}
                  disabled={detect.running}
                >
                  {detect.running ? (
                    <Loader2 aria-hidden className="size-3.5 animate-spin" />
                  ) : (
                    <Wand2 aria-hidden className="size-3.5" />
                  )}
                  {detect.running ? "Finding…" : "Find my keywords"}
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => setAddOpen(true)}
                >
                  <Plus aria-hidden className="size-3.5" />
                  Add manually
                </Button>
              </div>
            }
          />
        ) : byCountry ? (
          <CountryOverview
            rows={countries}
            onOpen={setCountry}
            onUpdate={(ids) => void enqueue(ids)}
            onCleanUp={(c) => setCleanup({ country: c })}
            onArchiveAll={(ids) => {
              const code = byId.get(ids[0])?.country ?? "";
              archiveAll(
                ids,
                COUNTRY_BY_CODE.get(code)?.name ?? code.toUpperCase(),
              );
            }}
          />
        ) : !shownCount ? (
          <EmptyState
            icon={SearchX}
            title="No keywords match"
            description="Try a different search or loosen the filters."
            action={
              <Button variant="secondary" size="md" onClick={clearFilters}>
                Clear search and filters
              </Button>
            }
          />
        ) : allMode ? (
          <GroupedKeywordTable
            groups={visibleGroups}
            expanded={expanded}
            sort={groupSort}
            onSort={onGroupSort}
            selected={selected}
            onSelectAll={(checked) =>
              setSelected(
                checked
                  ? new Set([...selected, ...visibleRows.map((k) => k.id)])
                  : EMPTY,
              )
            }
            refreshing={refreshing}
            handlers={handlers}
          />
        ) : (
          <KeywordTable
            rows={visible}
            sort={sort}
            onSort={onSort}
            selected={selected}
            onSelectAll={(checked) =>
              setSelected(
                checked
                  ? new Set([...selected, ...visible.map((k) => k.id)])
                  : EMPTY,
              )
            }
            refreshing={refreshing}
            sparklines={history?.series}
            handlers={handlers}
          />
        )}
      </div>
        </>
      )}

      {app && (
        <>
          <AddKeywordsSheet
            open={addOpen}
            onOpenChange={setAddOpen}
            appId={appId}
            defaultCountry={allMode ? homeCountry : country}
            onAdded={(c, added) => {
              setAddOpen(false);
              if (allMode) void mutate();
              else setCountry(c);
              void revalidate("/api/apps");
              const ids = added
                .filter((k) => !k.lastRefreshedAt)
                .map((k) => k.id);
              ids.forEach((id) => autoQueued.current.add(id));
              enqueue(ids);
            }}
          />
          <KeywordDetailSheet
            app={app}
            keyword={panel?.type === "detail" ? byId.get(panel.id) : undefined}
            refreshing={panel ? refreshing.has(panel.id) : false}
            onClose={() => setPanel(null)}
            onLike={handlers.onLike}
            onRefresh={handlers.onRefresh}
            onTopApps={handlers.onTopApps}
            onNotesSaved={onNotesSaved}
          />
          <CleanupSheet
            appId={appId}
            country={cleanup?.country ?? null}
            open={cleanup != null}
            onOpenChange={(open) => !open && setCleanup(null)}
            onArchived={onCleaned}
          />
          <TopAppsSheet
            app={app}
            keyword={panel?.type === "top" ? byId.get(panel.id) : undefined}
            onClose={() => setPanel(null)}
          />
        </>
      )}

      <DeleteKeywordsDialog
        keywords={pendingDelete
          .map((id) => byId.get(id))
          .filter((k): k is TrackedKeyword => !!k)}
        onCancel={() => setPendingDelete([])}
        onConfirm={() => void confirmDelete()}
        note={deleteNote}
      />
    </>
  );
}
