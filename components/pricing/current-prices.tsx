"use client";

import { useState } from "react";
import { CalendarClock, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import Button from "@/components/_ui/button";
import { Checkbox } from "@/components/_ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/_ui/dialog";
import Tag from "@/components/_ui/tag";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import { api } from "@/lib/client/api";
import { territoryInfo } from "@/lib/asc/territories";
import type { ProductKind, ProductPrices, ScheduleResult, TerritoryPrice } from "@/lib/asc/types";
import { formatDate, money } from "./pricing-utils";

function TerritoryCell({ territory }: { territory: string }) {
  const info = territoryInfo(territory);
  return (
    <span className="flex items-center gap-2">
      <span aria-hidden>{info.flag}</span>
      <span className="text-[13px]">{info.name}</span>
      <span className="caption-style text-subtle">{territory}</span>
    </span>
  );
}

type Props = { appId: number; kind: ProductKind; productId: string; prices: ProductPrices; onChanged: () => void };

export default function CurrentPrices({ appId, kind, productId, prices, onChanged }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failures, setFailures] = useState<ScheduleResult[]>([]);

  const toggle = (id: string, on: boolean) => setSelected((s) => {
    const next = new Set(s);
    if (on) next.add(id);
    else next.delete(id);
    return next;
  });

  async function cancel() {
    setBusy(true);
    try {
      const results = await api<ScheduleResult[]>(`/api/asc/apps/${appId}/pricing/cancel`, { method: "POST", body: { kind, productId, priceIds: [...selected] } });
      const failed = results.filter((r) => !r.ok);
      setFailures(failed);
      const ok = results.length - failed.length;
      if (ok) toast.success(`Cancelled ${ok} upcoming change${ok === 1 ? "" : "s"}`);
      if (failed.length) toast.error(`${failed.length} could not be cancelled`);
      setSelected(new Set());
      setConfirm(false);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cancel failed");
    } finally {
      setBusy(false);
    }
  }

  const upcoming = prices.upcoming.filter((u) => u.priceId);
  const cancellable = kind === "subscription" ? upcoming : upcoming.filter((u) => u.manual);

  return (
    <div className="flex flex-col gap-6 p-5">
      {upcoming.length > 0 && (
        <section className="flex flex-col gap-3" aria-label="Upcoming price changes">
          <div className="flex flex-wrap items-center gap-2">
            <CalendarClock aria-hidden className="text-soft size-4" />
            <h3 className="font-medium">Upcoming changes</h3>
            <span className="caption-style text-subtle">{upcoming.length}</span>
            <span className="flex-1" />
            <Button variant="secondary" size="sm" disabled={!selected.size} onClick={() => setConfirm(true)}>
              <XCircle aria-hidden className="size-3.5" />
              Cancel selected ({selected.size})
            </Button>
          </div>
          {failures.length > 0 && (
            <ul className="caption-style text-danger flex flex-col gap-1">
              {failures.map((f) => (
                <li key={f.territory}>
                  {territoryInfo(f.territory).name}: {f.error}
                </li>
              ))}
            </ul>
          )}
          <PriceTable rows={upcoming} selectable={new Set(cancellable.map((c) => c.priceId as string))} selected={selected} onToggle={toggle} />
        </section>
      )}
      <section className="flex flex-col gap-3" aria-label="Current prices">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-medium">Current prices</h3>
          <span className="caption-style text-subtle">{prices.current.length} storefronts</span>
          {prices.baseTerritory && (
            <Tag size="sm" tone="blue" className="text-[12px]">
              Base: {territoryInfo(prices.baseTerritory).name}
            </Tag>
          )}
        </div>
        {prices.current.length ? (
          <PriceTable rows={prices.current} showManual={kind === "iap"} />
        ) : (
          <p className="text-subtle">No price is set for this product yet. Set a base price in App Store Connect first.</p>
        )}
      </section>
      <Dialog open={confirm} onOpenChange={(v) => !busy && setConfirm(v)}>
        <DialogContent>
          <DialogHeader className="pr-12">
            <DialogTitle>Cancel {selected.size} upcoming change{selected.size === 1 ? "" : "s"}?</DialogTitle>
            <DialogDescription>
              {kind === "subscription"
                ? "The scheduled subscription prices are deleted in App Store Connect. Current prices stay as they are."
                : "The in-app purchase price schedule is rewritten without these future prices. Current prices stay as they are."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" size="md" disabled={busy} onClick={() => setConfirm(false)}>
              Keep
            </Button>
            <Button variant="muted" size="md" className="text-danger" disabled={busy} onClick={() => void cancel()}>
              {busy && <Loader2 aria-hidden className="size-3.5 animate-spin" />}
              Cancel changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PriceTable({
  rows,
  selectable,
  selected,
  onToggle,
  showManual,
}: {
  rows: TerritoryPrice[];
  selectable?: Set<string>;
  selected?: Set<string>;
  onToggle?: (id: string, on: boolean) => void;
  showManual?: boolean;
}) {
  return (
    <div className="border-border overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            {onToggle && <TableHead className="w-10" />}
            <TableHead>Territory</TableHead>
            <TableHead>Currency</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead className="text-right">Proceeds</TableHead>
            <TableHead>Starts</TableHead>
            <TableHead>Notes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={`${r.priceId ?? r.territory}-${r.startDate ?? ""}`} className="last:border-b-0">
              {onToggle && (
                <TableCell>
                  {r.priceId && selectable?.has(r.priceId) && (
                    <Checkbox aria-label={`Select ${r.territory}`} checked={selected?.has(r.priceId)} onCheckedChange={(v) => onToggle(r.priceId as string, v === true)} />
                  )}
                </TableCell>
              )}
              <TableCell>
                <TerritoryCell territory={r.territory} />
              </TableCell>
              <TableCell className="text-soft">{r.currency ?? "—"}</TableCell>
              <TableCell className="text-right tabular-nums">{money(r.customerPrice, r.currency)}</TableCell>
              <TableCell className="text-soft text-right tabular-nums">{money(r.proceeds, r.currency)}</TableCell>
              <TableCell className="text-soft">{formatDate(r.startDate)}</TableCell>
              <TableCell className="caption-style text-subtle">
                {[r.preserved ? "existing subscribers preserved" : null, showManual ? (r.manual ? "manual" : "auto-equalized") : null].filter(Boolean).join(" · ")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
