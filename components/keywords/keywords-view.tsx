"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Download,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  SearchX,
  Wand2,
} from "lucide-react";
import Button from "@/components/_ui/button";
import CountBadge from "@/components/_ui/count-badge";
import CountrySelect from "@/components/shell/country-select";
import EmptyState from "@/components/shell/empty-state";
import PageHeader from "@/components/shell/page-header";
import { ALL_COUNTRIES, useAppCountry, useCurrentApp } from "@/hooks/use-app";
import { COUNTRY_BY_CODE } from "@/lib/appstore/countries";
import { revalidate, useApi } from "@/lib/client/api";
import type { TrackedKeyword } from "@/lib/client/types";
import type { PositionSeries } from "@/lib/keywords/history";
import {
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
  type Filters,
  type GroupSort,
  type GroupSortKey,
  type KeywordGroup,
  type Sort,
  type SortKey,
} from "@/lib/keywords/table";
import { slugify } from "@/lib/utils";
import AddKeywordsSheet from "./add-keywords-sheet";
import DeleteKeywordsDialog from "./delete-keywords-dialog";
import DetectBanner, { DetectSummary } from "./detect-banner";
import DetectMenu from "./detect-menu";
import type { GroupHandlers } from "./grouped-keyword-row";
import GroupedKeywordTable from "./grouped-keyword-table";
import KeywordDetailSheet from "./keyword-detail-sheet";
import KeywordTable, { KeywordTableSkeleton } from "./keyword-table";
import KeywordToolbar from "./keyword-toolbar";
import MinCountriesFilter from "./min-countries-filter";
import TopAppsSheet from "./top-apps-sheet";
import { useKeywordActions } from "./use-keyword-actions";
import { useKeywordDetect } from "./use-keyword-detect";
import { useRefreshQueue } from "./use-refresh-queue";

type Panel = { type: "detail" | "top"; id: number } | null;

const EMPTY = new Set<number>();
const NO_GROUPS: KeywordGroup[] = [];

export default function KeywordsView() {
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

  const [query, setQuery] = useState("");
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
    void revalidate("/api/apps");
  }, [mutate]);
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
      onDelete: (ids) => setPendingDelete(ids),
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

  function refreshAll() {
    const stale = all.filter((k) => isStale(k)).map((k) => k.id);
    enqueue(stale.length ? stale : all.map((k) => k.id));
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
            <Button
              variant="secondary"
              size="icon"
              aria-label="Refresh stale keywords"
              title="Refresh keywords older than 20 hours"
              onClick={refreshAll}
              disabled={!all.length}
            >
              <RefreshCw
                aria-hidden
                className={busy ? "size-3.5 animate-spin" : "size-3.5"}
              />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              aria-label="Export CSV"
              title="Export visible keywords as CSV"
              onClick={() => actions.exportCsv(visibleRows, exportName())}
              disabled={!visibleRows.length}
            >
              <Download aria-hidden className="size-3.5" />
            </Button>
            <DetectMenu
              country={allMode ? homeCountry : country}
              trackedCount={trackedCount}
              running={detect.running}
              disabled={!app}
              onDetect={(scope) => void detect.start(scope)}
            />
            <Button
              variant="primary"
              size="sm"
              className="h-[30px] px-3"
              onClick={() => setAddOpen(true)}
              disabled={!app}
              aria-label="Add keywords"
            >
              <Plus aria-hidden className="size-3.5" />
              <span className="hidden sm:inline">Add keywords</span>
            </Button>
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

      <KeywordToolbar
        query={query}
        onQuery={setQuery}
        filters={filters}
        onFilters={setFilters}
        extraFilters={
          allMode && (
            <MinCountriesFilter
              value={minCountries}
              max={countryCount}
              onChange={setMinCountries}
            />
          )
        }
        shown={shownCount}
        total={allMode ? groups.length : all.length}
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
        onDelete={() => setPendingDelete(selectedRows.map((k) => k.id))}
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
            description="Detect the keywords this app already ranks for, or add the search terms you want to rank for. Each one is scored for popularity and difficulty, and your position is tracked daily."
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
                  {detect.running ? "Detecting…" : "Detect my keywords"}
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
            app={app}
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
      />
    </>
  );
}
