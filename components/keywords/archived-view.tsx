"use client";

import { useMemo, useState } from "react";
import { ArchiveRestore, ArchiveX, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import Button from "@/components/_ui/button";
import { Checkbox } from "@/components/_ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/_ui/dialog";
import { Input } from "@/components/_ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import EmptyState from "@/components/shell/empty-state";
import { PositionBadge, ScoreBar } from "@/components/shell/score";
import { COUNTRY_BY_CODE } from "@/lib/appstore/countries";
import { normalizeTerm } from "@/lib/aso/scoring";
import { api } from "@/lib/client/api";
import { timeAgo } from "@/lib/client/format";
import { cn } from "@/lib/utils";
import { reasonLabel, restoreIds, type ArchivableKeyword } from "./archive-types";
import WhereCell from "./where-cell";

const HEAD = "sticky top-0 z-20 bg-background shadow-[inset_0_-1px_0_var(--border)]";
const NONE: ReadonlySet<number> = new Set();

type Props = {
  appId: number;
  rows: ArchivableKeyword[];
  showCountry: boolean;
  onChanged: () => void;
  onBack: () => void;
};

export default function ArchivedView({ appId, rows, showCountry, onChanged, onBack }: Props) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ReadonlySet<number>>(NONE);
  const [confirmDelete, setConfirmDelete] = useState<number[]>([]);
  const [working, setWorking] = useState(false);

  const visible = useMemo(() => {
    const q = normalizeTerm(query);
    return rows.filter((k) => !q || k.term.includes(q)).sort((a, b) => (b.archivedAt ?? "").localeCompare(a.archivedAt ?? "") || a.term.localeCompare(b.term));
  }, [rows, query]);
  const picked = visible.filter((k) => selected.has(k.id)).map((k) => k.id);
  const allState = picked.length === 0 ? false : picked.length === visible.length ? true : "indeterminate";

  function toggle(id: number, on: boolean) {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    setSelected(next);
  }

  async function restore(ids: number[]) {
    if (!ids.length || working) return;
    setWorking(true);
    try {
      const restored = await restoreIds(appId, ids);
      toast.success(`${restored} keyword${restored === 1 ? "" : "s"} restored with ${restored === 1 ? "its" : "their"} history`);
      setSelected(NONE);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not restore keywords");
    } finally {
      setWorking(false);
    }
  }

  async function deleteForever() {
    const ids = confirmDelete;
    setConfirmDelete([]);
    setWorking(true);
    try {
      await api(`/api/apps/${appId}/keywords`, { method: "DELETE", body: { ids } });
      toast.success(`${ids.length} keyword${ids.length === 1 ? "" : "s"} deleted permanently`);
      setSelected(NONE);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete keywords");
    } finally {
      setWorking(false);
    }
  }

  if (!rows.length)
    return (
      <EmptyState
        icon={ArchiveX}
        title="No archived keywords"
        description="Keywords you archive, or that Clean up archives because they left your metadata and stopped ranking, are kept here with their rank history."
        action={
          <Button variant="secondary" size="md" onClick={onBack}>
            Back to tracked keywords
          </Button>
        }
      />
    );

  return (
    <>
      <div className="border-border flex min-h-[50px] shrink-0 flex-wrap items-center gap-2 border-b px-4 py-2">
        <div className="relative w-full sm:w-[240px]">
          <Search aria-hidden className="text-subtle pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search archived keywords"
            aria-label="Search archived keywords"
            className="h-[30px] rounded-full pl-8 text-[13px]"
          />
        </div>
        {picked.length > 0 ? (
          <div role="toolbar" aria-label="Bulk actions" className="border-line-strong flex flex-wrap items-center gap-1.5 sm:ml-auto sm:border-l sm:pl-3">
            <Button variant="ghost" size="icon-sm" aria-label="Clear selection" onClick={() => setSelected(NONE)}>
              <X aria-hidden className="size-3.5" />
            </Button>
            <span className="caption-style text-foreground mr-2 tabular-nums">{picked.length} selected</span>
            <Button variant="secondary" size="sm" className="h-[30px]" disabled={working} onClick={() => void restore(picked)}>
              <ArchiveRestore aria-hidden className="size-3.5" />
              Restore
            </Button>
            <Button variant="secondary" size="sm" className="text-danger h-[30px]" disabled={working} onClick={() => setConfirmDelete(picked)}>
              <Trash2 aria-hidden className="size-3.5" />
              Delete permanently
            </Button>
          </div>
        ) : (
          <span className="caption-style text-subtle ml-auto hidden sm:inline">
            Archived keywords are hidden everywhere else and are not re-checked. They come back by themselves if they rank again or return to your metadata.
          </span>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {!visible.length ? (
          <EmptyState icon={Search} title="No archived keyword matches" description="Try a different search." />
        ) : (
          <Table className="min-w-[900px] text-[13px]">
            <TableHeader>
              <TableRow className="border-0">
                <TableHead className={cn(HEAD, "w-10 pr-0 pl-4")}>
                  <Checkbox
                    aria-label="Select all archived keywords"
                    checked={allState}
                    onCheckedChange={(v) => setSelected(v === true ? new Set(visible.map((k) => k.id)) : NONE)}
                  />
                </TableHead>
                <TableHead className={HEAD}>Keyword</TableHead>
                {showCountry && <TableHead className={HEAD}>Country</TableHead>}
                <TableHead className={HEAD} title="Why this keyword was archived">
                  Reason
                </TableHead>
                <TableHead className={HEAD} title="Your position the last time this keyword was checked (top 200)">
                  Last position
                </TableHead>
                <TableHead className={HEAD} title="Where the keyword is in your indexed metadata today">
                  In metadata now
                </TableHead>
                <TableHead className={HEAD} title="Search popularity the last time it was checked, 5–100">
                  Popularity
                </TableHead>
                <TableHead className={HEAD}>Archived</TableHead>
                <TableHead className={cn(HEAD, "w-10")}>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((k) => {
                const meta = COUNTRY_BY_CODE.get(k.country);
                return (
                  <TableRow key={k.id} data-selected={selected.has(k.id)} className="bg-background hover:bg-[#1b1b1b] data-[selected=true]:bg-[#1c1a29]">
                    <TableCell className="w-10 pr-0 pl-4">
                      <Checkbox aria-label={`Select ${k.term}`} checked={selected.has(k.id)} onCheckedChange={(v) => toggle(k.id, v === true)} />
                    </TableCell>
                    <TableCell className="max-w-[280px] truncate">{k.term}</TableCell>
                    {showCountry && (
                      <TableCell className="text-soft">
                        <span aria-hidden className="mr-1.5">
                          {meta?.flag}
                        </span>
                        {meta?.name ?? k.country.toUpperCase()}
                      </TableCell>
                    )}
                    <TableCell className="caption-style text-soft">{k.archiveReason ? reasonLabel(k.archiveReason) : "—"}</TableCell>
                    <TableCell>
                      <PositionBadge position={k.position} />
                    </TableCell>
                    <TableCell>
                      <WhereCell keyword={k} />
                    </TableCell>
                    <TableCell>
                      <ScoreBar value={k.popularity} />
                    </TableCell>
                    <TableCell className="caption-style text-subtle">{timeAgo(k.archivedAt)}</TableCell>
                    <TableCell className="pr-3 pl-0 text-right">
                      <Button variant="ghost" size="sm" className="h-[26px]" disabled={working} onClick={() => void restore([k.id])} aria-label={`Restore ${k.term}`}>
                        <ArchiveRestore aria-hidden className="size-3.5" />
                        Restore
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={confirmDelete.length > 0} onOpenChange={(open) => !open && setConfirmDelete([])}>
        <DialogContent className="max-w-[420px]">
          <div className="flex flex-col gap-5 p-5">
            <div className="flex flex-col gap-2 pr-8">
              <DialogTitle className="h2-style">
                Delete {confirmDelete.length} keyword{confirmDelete.length === 1 ? "" : "s"} permanently?
              </DialogTitle>
              <DialogDescription className="text-subtle p-style">
                The rank history is erased and cannot be recovered. Keep keywords archived instead if they might come back.
              </DialogDescription>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="md" autoFocus onClick={() => setConfirmDelete([])}>
                Cancel
              </Button>
              <Button variant="primary" size="md" className="bg-danger hover:bg-danger/90 text-background" onClick={() => void deleteForever()}>
                Delete permanently
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
