"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import Button from "@/components/_ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/_ui/dialog";
import { Input } from "@/components/_ui/input";
import AppIcon from "@/components/shell/app-icon";
import { RatingMeta } from "@/components/explore/app-card";
import { api, revalidate, useApi } from "@/lib/client/api";
import type { StoreApp } from "@/lib/client/types";
import type { Competitor, CompetitorSuggestion } from "@/lib/competitors/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appId: number;
  appTrackId: number;
  country: string;
  existing: number[];
};

type Row = { trackId: number; name: string; iconUrl: string; developer: string; rating: number; ratingCount: number; note?: string };

function ResultRow({ row, own, added, busy, disabled, onAdd }: { row: Row; own: boolean; added: boolean; busy: boolean; disabled: boolean; onAdd: () => void }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <AppIcon src={row.iconUrl} name={row.name} className="size-10" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="truncate text-[14px]">{row.name}</span>
        <span className="caption-style text-subtle flex items-center gap-1.5 truncate">
          <span className="truncate">{row.developer}</span>
          <span>·</span>
          <RatingMeta rating={row.rating} count={row.ratingCount} />
        </span>
        {row.note && <span className="caption-style text-soft truncate">{row.note}</span>}
      </div>
      {own ? (
        <span className="caption-style text-subtle">Your app</span>
      ) : added ? (
        <span className="caption-style text-trend inline-flex items-center gap-1">
          <Check aria-hidden className="size-3.5" /> Added
        </span>
      ) : (
        <Button variant="muted" size="sm" disabled={disabled} onClick={onAdd} aria-label={`Add ${row.name} as competitor`}>
          {busy ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : "Add"}
        </Button>
      )}
    </li>
  );
}

export default function AddCompetitorDialog({ open, onOpenChange, appId, appTrackId, country, existing }: Props) {
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [adding, setAdding] = useState<number | null>(null);
  const [added, setAdded] = useState<number[]>([]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 300);
    return () => clearTimeout(t);
  }, [term]);

  const { data: results, isLoading: searching } = useApi<StoreApp[]>(open && debounced.length > 1 ? `/api/explore/search?q=${encodeURIComponent(debounced)}&country=${country}` : null);
  const { data: suggestions, isLoading: loadingSuggestions } = useApi<CompetitorSuggestion[]>(open ? `/api/apps/${appId}/competitors/suggestions?country=${country}` : null);

  const taken = new Set([...existing, ...added, appTrackId]);

  async function add(row: Row) {
    setAdding(row.trackId);
    try {
      const created = await api<Competitor>(`/api/apps/${appId}/competitors`, { method: "POST", body: { trackId: row.trackId, country } });
      setAdded((prev) => [...prev, row.trackId]);
      await revalidate(`/api/apps/${appId}/competitors`);
      toast.success(`${created.name} added as a competitor`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add competitor");
    } finally {
      setAdding(null);
    }
  }

  const searchRows: Row[] = (results ?? []).map((a) => ({
    trackId: a.trackId,
    name: a.trackName,
    iconUrl: a.artworkUrl100,
    developer: a.sellerName,
    rating: a.averageUserRating,
    ratingCount: a.userRatingCount,
  }));
  const suggestionRows: Row[] = (suggestions ?? []).map((s) => ({
    ...s,
    note: `Top 10 for ${s.appearances} of your keywords · best #${s.bestPosition} · ${s.keywords.slice(0, 3).join(", ")}`,
  }));
  const showSearch = debounced.length > 1;
  const rows = showSearch ? searchRows : suggestionRows;
  const loading = showSearch ? searching : loadingSuggestions;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) {
          setTerm("");
          setAdded([]);
        }
      }}
    >
      <DialogContent className="max-w-[580px]">
        <div className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-2 pr-8">
            <DialogTitle>Add competitor</DialogTitle>
            <DialogDescription className="text-subtle p-style">Search the App Store, or pick an app that already ranks for your tracked keywords.</DialogDescription>
          </div>
          <div className="relative">
            <Search aria-hidden className="text-subtle absolute top-1/2 left-3 size-3.5 -translate-y-1/2" />
            <Input autoFocus value={term} onChange={(e) => setTerm(e.target.value)} placeholder="App name, developer or App ID…" className="pl-8" aria-label="Search the App Store" />
          </div>
          {!showSearch && (
            <p className="eyebrow-style text-subtle flex items-center gap-1.5">
              <Sparkles aria-hidden className="size-3" /> Suggested from your keywords
            </p>
          )}
          <ul className="divide-border flex max-h-[400px] flex-col divide-y overflow-y-auto" aria-busy={loading}>
            {loading && (
              <li className="text-subtle flex items-center gap-2 py-6">
                <Loader2 aria-hidden className="size-4 animate-spin" /> {showSearch ? "Searching…" : "Loading suggestions…"}
              </li>
            )}
            {!loading &&
              rows.map((row) => (
                <ResultRow
                  key={row.trackId}
                  row={row}
                  own={row.trackId === appTrackId}
                  added={taken.has(row.trackId)}
                  busy={adding === row.trackId}
                  disabled={adding !== null}
                  onAdd={() => void add(row)}
                />
              ))}
            {!loading && !rows.length && (
              <li className="text-subtle py-6">{showSearch ? "No apps found in this storefront." : "No suggestions yet — track and analyze keywords to see who ranks for them."}</li>
            )}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
