"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, Layers, Loader2, Plus, RefreshCw, Undo2 } from "lucide-react";
import { toast } from "sonner";
import Button from "@/components/_ui/button";
import CountBadge from "@/components/_ui/count-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/_ui/tabs";
import AscErrorPanel from "@/components/asc/asc-error";
import { AscGateFallback, AscMenu, AscStatusBar, useAscGate } from "@/components/asc/asc-gate";
import EmptyState from "@/components/shell/empty-state";
import PageHeader from "@/components/shell/page-header";
import { useAppCountry, useCurrentApp } from "@/hooks/use-app";
import { api, useApi } from "@/lib/client/api";
import { localeName, sameLocale } from "@/lib/asc/locales";
import type { AppMetadata, LocaleMetadata, MetadataField, MetadataPatch } from "@/lib/asc/types";
import { cn } from "@/lib/utils";
import DiffDialog, { type LocaleChange, type SaveOutcome } from "./diff-dialog";
import { charCount } from "./keyword-utils";
import { AddLocaleDialog, DeleteLocaleDialog } from "./locale-dialogs";
import LocalizationGrid from "./localization-grid";
import MetadataEditor from "./metadata-editor";
import PublicPreview from "./public-preview";
import ScreenshotsTab from "./screenshots-tab";
import UsMultiplierSheet from "./us-multiplier-sheet";

type Tab = "editor" | "grid" | "screenshots";
type Drafts = Record<string, MetadataPatch>;

export default function AppStorePage() {
  const { appId, app, error: appError } = useCurrentApp();
  const gate = useAscGate(app);
  const [country] = useAppCountry(app);
  const ready = gate.state === "ready";

  if (appError)
    return (
      <>
        <PageHeader title="App Store Page" />
        <EmptyState icon={AlertTriangle} title="App not found" description="This app may have been removed. Pick another app from the sidebar." />
      </>
    );

  if (!ready || !app)
    return (
      <>
        <PageHeader
          title="App Store Page"
          actions={
            app && gate.state !== "loading" && gate.state !== "disconnected" ? (
              <AscMenu app={app} onSetup={() => gate.setSetupOpen(true)} />
            ) : null
          }
        />
        {app && gate.state !== "loading" && gate.state !== "ready" ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="border-border border-b p-4">
              <AscStatusBar state={gate.state} app={app} error={gate.status?.error ?? null} feature="edit metadata, keywords and locales" onSetup={() => gate.setSetupOpen(true)} />
            </div>
            <PublicPreview app={app} />
          </div>
        ) : (
          <AscGateFallback state="loading" app={app} feature="edit your App Store page" error={null} onSetup={() => gate.setSetupOpen(true)} />
        )}
        {gate.sheet}
      </>
    );

  return (
    <>
      <Editor appId={appId} country={country} menu={<AscMenu app={app} onSetup={() => gate.setSetupOpen(true)} />} />
      {gate.sheet}
    </>
  );
}

function Editor({ appId, country, menu }: { appId: number; country: string; menu: ReactNode }) {
  const key = `/api/asc/apps/${appId}/metadata`;
  const { data: meta, error, isLoading, mutate } = useApi<AppMetadata>(key);
  const [tab, setTab] = useState<Tab>("editor");
  const [selected, setSelected] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Drafts>({});
  const [refreshing, setRefreshing] = useState(false);
  const [diffOpen, setDiffOpen] = useState(false);
  const [addLocale, setAddLocale] = useState<{ initial?: string } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [multiplierOpen, setMultiplierOpen] = useState(false);

  const locales = useMemo(() => meta?.localizations ?? [], [meta]);
  const current = locales.find((l) => selected && sameLocale(l.locale, selected)) ?? locales[0];
  const byLocale = useMemo(() => new Map(locales.map((l) => [l.locale, l])), [locales]);

  const value = useCallback(
    (locale: string, f: MetadataField) => drafts[locale]?.[f] ?? byLocale.get(locale)?.[f] ?? "",
    [drafts, byLocale],
  );

  const changes = useMemo<LocaleChange[]>(
    () =>
      Object.entries(drafts)
        .filter(([, patch]) => Object.keys(patch).length)
        .map(([locale, patch]) => {
          const loc = byLocale.get(locale);
          const before = Object.fromEntries(Object.keys(patch).map((f) => [f, loc?.[f as MetadataField] ?? ""]));
          return { locale, patch, before };
        }),
    [drafts, byLocale],
  );
  const dirtyCount = changes.reduce((n, c) => n + Object.keys(c.patch).length, 0);
  const dirtyLocales = useMemo(() => new Set(changes.map((c) => c.locale)), [changes]);

  useEffect(() => {
    if (!dirtyCount) return;
    const onUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [dirtyCount]);

  function setField(loc: LocaleMetadata, f: MetadataField, v: string) {
    setDrafts((d) => {
      const patch = { ...d[loc.locale] };
      if (v === (loc[f] ?? "")) delete patch[f];
      else patch[f] = v;
      return { ...d, [loc.locale]: patch };
    });
  }

  async function refresh() {
    setRefreshing(true);
    try {
      await mutate(api<AppMetadata>(`${key}?refresh=1`), { revalidate: false });
      toast.success("Reloaded from App Store Connect");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  async function save(): Promise<SaveOutcome[]> {
    const outcomes: SaveOutcome[] = [];
    for (const c of changes) {
      try {
        await api(`/api/asc/apps/${appId}/metadata/${encodeURIComponent(c.locale)}`, { method: "PATCH", body: c.patch });
        outcomes.push({ locale: c.locale, ok: true });
        setDrafts((d) => {
          const next = { ...d };
          delete next[c.locale];
          return next;
        });
      } catch (e) {
        outcomes.push({ locale: c.locale, ok: false, error: e instanceof Error ? e.message : "Save failed" });
      }
    }
    await mutate();
    const ok = outcomes.filter((o) => o.ok).length;
    if (ok) toast.success(`Saved ${ok} locale${ok === 1 ? "" : "s"} to App Store Connect`);
    if (ok < outcomes.length) toast.error(`${outcomes.length - ok} locale${outcomes.length - ok === 1 ? "" : "s"} failed to save`);
    return outcomes;
  }

  async function createLocale(locale: string) {
    await api(`/api/asc/apps/${appId}/locales`, { method: "POST", body: { locale } });
    await mutate();
    setSelected(locale);
    setTab("editor");
    toast.success(`${localeName(locale)} added`);
  }

  async function removeLocale(locale: string) {
    await api(`/api/asc/apps/${appId}/locales/${encodeURIComponent(locale)}`, { method: "DELETE" });
    setDrafts((d) => {
      const next = { ...d };
      delete next[locale];
      return next;
    });
    if (selected && sameLocale(selected, locale)) setSelected(null);
    await mutate();
    toast.success(`${localeName(locale)} deleted`);
  }

  const canAddLocale = !!meta && (!!meta.appInfo?.editable || !!meta.version?.editable);
  const openLocale = (locale: string) => {
    setSelected(locale);
    setTab("editor");
    setMultiplierOpen(false);
  };

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="min-h-0 flex-1">
      <PageHeader
        title="App Store Page"
        badge={meta && <CountBadge aria-label={`${locales.length} locales`}>{locales.length}</CountBadge>}
        actions={
          <>
            {dirtyCount > 0 && (
              <Button variant="ghost" size="sm" className="h-[30px]" onClick={() => setDrafts({})}>
                <Undo2 aria-hidden className="size-3.5" />
                Discard
              </Button>
            )}
            <Button variant="secondary" size="sm" className="h-[30px] px-3" disabled={!meta} onClick={() => setMultiplierOpen(true)}>
              <Layers aria-hidden className="size-3.5" />
              US multiplier
            </Button>
            <Button variant="secondary" size="icon" aria-label="Reload from App Store Connect" title="Reload from App Store Connect" disabled={refreshing || !meta} onClick={() => void refresh()}>
              <RefreshCw aria-hidden className={cn("size-3.5", refreshing && "animate-spin")} />
            </Button>
            {menu}
            <Button variant="primary" size="sm" className="h-[30px] px-3" disabled={!dirtyCount} onClick={() => setDiffOpen(true)}>
              Review &amp; save{dirtyCount ? ` (${dirtyCount})` : ""}
            </Button>
          </>
        }
      >
        <TabsList className="px-4">
          <TabsTrigger value="editor">Editor</TabsTrigger>
          <TabsTrigger value="grid">Localization grid</TabsTrigger>
          <TabsTrigger value="screenshots">Screenshots</TabsTrigger>
        </TabsList>
      </PageHeader>

      {error ? (
        <AscErrorPanel error={error} title="Could not load metadata from App Store Connect" onRetry={() => void mutate()} />
      ) : isLoading || !meta ? (
        <div className="text-subtle flex flex-1 items-center justify-center gap-2 py-16">
          <Loader2 aria-hidden className="size-4 animate-spin" /> Loading metadata from App Store Connect…
        </div>
      ) : !current ? (
        <EmptyState
          icon={Plus}
          title="No localizations yet"
          description="Create a version in App Store Connect, then add your first locale here."
          action={
            <Button variant="primary" size="md" disabled={!canAddLocale} onClick={() => setAddLocale({})}>
              Add locale
            </Button>
          }
        />
      ) : (
        <>
          <TabsContent value="editor" className="flex min-h-0 flex-1 flex-col md:flex-row">
            <LocaleList
              locales={locales}
              primary={meta.primaryLocale}
              selected={current.locale}
              dirty={dirtyLocales}
              keywordsLength={(l) => charCount(value(l, "keywords"))}
              onSelect={setSelected}
              canAdd={canAddLocale}
              onAdd={() => setAddLocale({})}
            />
            <MetadataEditor
              key={current.locale}
              appId={appId}
              meta={meta}
              loc={current}
              preferredCountry={country}
              value={(f) => value(current.locale, f)}
              isDirty={(f) => drafts[current.locale]?.[f] !== undefined}
              onChange={(f, v) => setField(current, f, v)}
              onDelete={() => setDeleting(current.locale)}
            />
          </TabsContent>
          <TabsContent value="grid" className="flex min-h-0 flex-1 flex-col">
            <LocalizationGrid meta={meta} value={value} dirtyLocales={dirtyLocales} onOpen={openLocale} />
          </TabsContent>
          <TabsContent value="screenshots" className="flex min-h-0 flex-1 flex-col md:flex-row">
            <LocaleList locales={locales} primary={meta.primaryLocale} selected={current.locale} dirty={new Set()} onSelect={setSelected} />
            {tab === "screenshots" && <ScreenshotsTab key={current.locale} appId={appId} locale={current.locale} />}
          </TabsContent>
        </>
      )}

      {meta && (
        <>
          <DiffDialog open={diffOpen} onOpenChange={setDiffOpen} changes={changes} onConfirm={save} />
          <AddLocaleDialog
            open={addLocale !== null}
            onOpenChange={(v) => !v && setAddLocale(null)}
            existing={locales.map((l) => l.locale)}
            initial={addLocale?.initial}
            onAdd={createLocale}
          />
          <DeleteLocaleDialog locale={deleting} onOpenChange={(v) => !v && setDeleting(null)} onDelete={removeLocale} />
          <UsMultiplierSheet
            open={multiplierOpen}
            onOpenChange={setMultiplierOpen}
            meta={meta}
            value={value}
            canAdd={canAddLocale}
            onAddLocale={(locale) => setAddLocale({ initial: locale })}
            onOpenLocale={openLocale}
          />
        </>
      )}
    </Tabs>
  );
}

function LocaleList({
  locales,
  primary,
  selected,
  dirty,
  keywordsLength,
  onSelect,
  canAdd,
  onAdd,
}: {
  locales: LocaleMetadata[];
  primary: string;
  selected: string;
  dirty: Set<string>;
  keywordsLength?: (locale: string) => number;
  onSelect: (locale: string) => void;
  canAdd?: boolean;
  onAdd?: () => void;
}) {
  return (
    <nav aria-label="Locales" className="border-border flex max-h-[40vh] shrink-0 flex-col border-b md:max-h-none md:w-[220px] md:border-r md:border-b-0">
      <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2">
        {locales.map((l) => {
          const active = sameLocale(l.locale, selected);
          return (
            <li key={l.locale}>
              <Button variant="nav" size="none" data-active={active} aria-current={active ? "true" : undefined} onClick={() => onSelect(l.locale)} className="h-auto gap-2 px-2.5 py-2">
                <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                  <span className="flex w-full items-center gap-1.5 text-[13px]">
                    <span className="truncate">{localeName(l.locale)}</span>
                    {dirty.has(l.locale) && <span className="bg-status size-1.5 shrink-0 rounded-full" aria-label="edited" />}
                  </span>
                  <span className="caption-style text-subtle">
                    {l.locale}
                    {sameLocale(l.locale, primary) ? " · primary" : ""}
                  </span>
                </span>
                {keywordsLength && <span className="caption-style text-subtle tabular-nums">{keywordsLength(l.locale)}</span>}
              </Button>
            </li>
          );
        })}
      </ul>
      {onAdd && (
        <div className="border-border border-t p-2">
          <Button variant="ghost" size="sm" className="w-full" disabled={!canAdd} title={canAdd ? undefined : "Create a new version in App Store Connect first"} onClick={onAdd}>
            <Plus aria-hidden className="size-3.5" />
            Add locale
          </Button>
        </div>
      )}
    </nav>
  );
}
