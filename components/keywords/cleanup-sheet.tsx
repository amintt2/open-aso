"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Archive, ChevronRight, Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import Button from "@/components/_ui/button";
import { Checkbox } from "@/components/_ui/checkbox";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/_ui/sheet";
import Tag from "@/components/_ui/tag";
import EmptyState from "@/components/shell/empty-state";
import { COUNTRY_BY_CODE } from "@/lib/appstore/countries";
import { api, useApi } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import { archiveIds, reasonLabel, type ArchiveCandidate, type ArchivePreview } from "./archive-types";

const SHARED_REASONS = new Set(["not-in-metadata", "unranked"]);

const NONE: ReadonlySet<number> = new Set();

function countryName(code: string) {
  return COUNTRY_BY_CODE.get(code)?.name ?? code.toUpperCase();
}

type Props = {
  appId: number;
  country: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onArchived: (ids: number[]) => void;
};

export default function CleanupSheet({ appId, country, open, onOpenChange, onArchived }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[520px]">
        {open && <CleanupBody key={country ?? "all"} appId={appId} country={country} onClose={() => onOpenChange(false)} onArchived={onArchived} />}
      </SheetContent>
    </Sheet>
  );
}

function CleanupBody({ appId, country, onClose, onArchived }: Omit<Props, "open" | "onOpenChange"> & { onClose: () => void }) {
  const { data, error, isLoading, mutate } = useApi<ArchivePreview>(`/api/apps/${appId}/keywords/archive${country ? `?country=${country}` : ""}`, {
    revalidateOnFocus: false,
    revalidateIfStale: true,
    dedupingInterval: 0,
  });
  const [kept, setKept] = useState<ReadonlySet<number>>(NONE);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const [removing, setRemoving] = useState(false);

  const groups = useMemo(() => {
    const map = new Map<string, ArchiveCandidate[]>();
    for (const c of data?.candidates ?? []) {
      const list = map.get(c.country);
      if (list) list.push(c);
      else map.set(c.country, [c]);
    }
    return [...map].map(([code, items]) => ({ code, items: [...items].sort((a, b) => a.term.localeCompare(b.term)) })).sort((a, b) => b.items.length - a.items.length);
  }, [data]);

  const total = data?.candidates.length ?? 0;
  const chosen = (data?.candidates ?? []).filter((c) => !kept.has(c.id));
  const single = groups.length === 1;

  function setMany(ids: number[], remove: boolean) {
    const next = new Set(kept);
    ids.forEach((id) => (remove ? next.delete(id) : next.add(id)));
    setKept(next);
  }

  function toggleGroup(code: string) {
    const next = new Set(expanded);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setExpanded(next);
  }

  async function remove() {
    if (!chosen.length) return;
    setRemoving(true);
    try {
      const ids = chosen.map((c) => c.id);
      const archived =
        ids.length === total
          ? (await api<{ archived: number }>(`/api/apps/${appId}/keywords/archive`, { method: "POST", body: country ? { country } : { all: true } })).archived
          : await archiveIds(appId, ids, "candidates");
      toast.success(`${archived} keyword${archived === 1 ? "" : "s"} archived. Restore them any time from Archived.`);
      onArchived(ids);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not archive keywords");
      setRemoving(false);
    }
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>Clean up {country ? countryName(country) : "all countries"}</SheetTitle>
        <SheetClose asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Close">
            <X aria-hidden className="size-4" />
          </Button>
        </SheetClose>
      </SheetHeader>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <SheetDescription className="border-border border-b px-6 py-4">
          Listed here: keywords that are not in the metadata Apple indexes for that storefront and that your app has not ranked for (top 200) in 14 days or more. Liked keywords and keywords with notes are never listed. Archiving hides a keyword from every page but keeps its rank history, and it comes back by itself if it ranks again or returns to your metadata. Untick anything you want to keep.
        </SheetDescription>
        {error ? (
          <EmptyState
            icon={AlertTriangle}
            title="Could not check your keywords"
            description={error instanceof Error ? error.message : "Unexpected error"}
            action={
              <Button variant="secondary" size="md" onClick={() => void mutate()}>
                Try again
              </Button>
            }
          />
        ) : isLoading || !data ? (
          <div role="status" className="text-subtle caption-style flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <Loader2 aria-hidden className="size-5 animate-spin" />
            Checking every keyword against your metadata and rankings. This can take a moment.
          </div>
        ) : !total ? (
          <EmptyState icon={Sparkles} title="Nothing to clean up" description={`All ${data.scanned.toLocaleString("en-US")} keywords checked are in your metadata, ranked recently, liked or noted.`} />
        ) : (
          <ul className="flex flex-col">
            {groups.map((g) => {
              const ids = g.items.map((c) => c.id);
              const picked = ids.filter((id) => !kept.has(id)).length;
              const state = picked === 0 ? false : picked === ids.length ? true : "indeterminate";
              const isOpen = single || expanded.has(g.code);
              const name = countryName(g.code);
              return (
                <li key={g.code} className="border-border border-b">
                  <div className="flex h-11 items-center gap-2 px-6">
                    <Checkbox aria-label={`Archive all candidates in ${name}`} checked={state} onCheckedChange={(v) => setMany(ids, v === true)} />
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      disabled={single}
                      onClick={() => toggleGroup(g.code)}
                      className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left text-[13px] outline-none focus-visible:underline disabled:cursor-default"
                    >
                      {!single && <ChevronRight aria-hidden className={cn("text-subtle size-3.5 shrink-0 transition-transform duration-150", isOpen && "rotate-90")} />}
                      <span aria-hidden>{COUNTRY_BY_CODE.get(g.code)?.flag}</span>
                      <span className="truncate">{name}</span>
                    </button>
                    <span className="caption-style text-subtle tabular-nums">
                      {picked === ids.length ? `${ids.length} to archive` : `${picked} of ${ids.length} to archive`}
                    </span>
                  </div>
                  {isOpen && (
                    <ul className="bg-card flex flex-col">
                      {g.items.map((c) => (
                        <li key={c.id}>
                          <label className="flex min-h-9 cursor-pointer items-center gap-2 py-1.5 pr-6 pl-12 hover:bg-white/4">
                            <Checkbox aria-label={`Archive ${c.term}`} checked={!kept.has(c.id)} onCheckedChange={(v) => setMany([c.id], v === true)} />
                            <span className="min-w-0 flex-1 truncate text-[13px]">{c.term}</span>
                            {c.reasons
                              .filter((r) => !SHARED_REASONS.has(r))
                              .map((r) => (
                                <Tag key={r} tone="amber" size="sm" className="text-[12px]">
                                  {reasonLabel(r)}
                                </Tag>
                              ))}
                            <span
                              className="caption-style text-subtle shrink-0 text-right tabular-nums"
                              title={c.lastRankedAt ? `Last seen in the top 200 on ${c.lastRankedAt}, best position #${c.bestPosition}` : "Never seen in the top 200 since you started tracking it"}
                            >
                              {c.bestPosition == null ? "never ranked" : `best #${c.bestPosition}`}
                            </span>
                            <span className="caption-style text-subtle w-12 shrink-0 text-right tabular-nums" title="Search popularity, 5 to 100">
                              {c.popularity == null ? "—" : `pop ${Math.round(c.popularity)}`}
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <SheetFooter>
        <span className="caption-style text-subtle tabular-nums">
          {data ? `${chosen.length.toLocaleString("en-US")} of ${total.toLocaleString("en-US")} selected · ${data.scanned.toLocaleString("en-US")} checked` : ""}
        </span>
        <Button variant="primary" size="md" disabled={!chosen.length || removing} onClick={() => void remove()}>
          {removing ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : <Archive aria-hidden className="size-3.5" />}
          Archive {chosen.length ? chosen.length.toLocaleString("en-US") : ""} keyword{chosen.length === 1 ? "" : "s"}
        </Button>
      </SheetFooter>
    </>
  );
}
