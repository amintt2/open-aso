"use client";

import { useState } from "react";
import { Info, Loader2 } from "lucide-react";
import Button from "@/components/_ui/button";
import { Checkbox } from "@/components/_ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/_ui/dialog";
import { Input } from "@/components/_ui/input";
import { Label } from "@/components/_ui/label";
import { territoryInfo } from "@/lib/asc/territories";
import type { PlanRow, ProductKind } from "@/lib/asc/types";
import { formatDate, isoDate } from "./pricing-utils";

export type StartMode = "today" | "tomorrow" | "custom";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: ProductKind;
  rows: PlanRow[];
  baseTerritory: string | null;
  running: { done: number; total: number } | null;
  onConfirm: (opts: { startMode: StartMode; customDate: string; preserve: boolean }) => Promise<void>;
};

const MODES: { value: StartMode; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "custom", label: "Custom date" },
];

export default function ScheduleDialog({ open, onOpenChange, kind, rows, baseTerritory, running, onConfirm }: Props) {
  const [startMode, setStartMode] = useState<StartMode>("tomorrow");
  const [customDate, setCustomDate] = useState(isoDate(7));
  const [preserve, setPreserve] = useState(true);
  const increases = rows.filter((r) => r.current != null && r.proposed != null && r.proposed > r.current).length;
  const decreases = rows.filter((r) => r.current != null && r.proposed != null && r.proposed < r.current).length;
  const customValid = startMode !== "custom" || customDate >= isoDate(0);
  const start = startMode === "today" ? null : startMode === "tomorrow" ? isoDate(1) : customDate;
  const busy = running !== null;

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader className="pr-12">
          <DialogTitle>Schedule {rows.length} price change{rows.length === 1 ? "" : "s"}</DialogTitle>
          <DialogDescription>
            {increases} increase{increases === 1 ? "" : "s"} · {decreases} decrease{decreases === 1 ? "" : "s"} · written to App Store Connect
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-5 px-6 py-5">
          <div className="flex flex-col gap-2">
            <span className="caption-style text-soft">Start date</span>
            <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Start date">
              {MODES.map((m) => (
                <Button key={m.value} role="radio" aria-checked={startMode === m.value} variant={startMode === m.value ? "muted" : "ghost"} size="sm" onClick={() => setStartMode(m.value)}>
                  {m.label}
                </Button>
              ))}
              {startMode === "custom" && <Input type="date" aria-label="Custom start date" min={isoDate(0)} value={customDate} onChange={(e) => setCustomDate(e.target.value)} className="h-[30px] w-[160px]" />}
            </div>
            <span className="caption-style text-subtle">{start ? `Takes effect ${formatDate(start)}` : "Takes effect as soon as Apple processes it"}</span>
          </div>

          {kind === "subscription" ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Checkbox id="preserve" checked={preserve} onCheckedChange={(v) => setPreserve(v === true)} />
                <Label htmlFor="preserve" className="text-foreground text-[14px]">
                  Preserve current price for existing subscribers
                </Label>
              </div>
              <p className="caption-style text-subtle leading-[1.45]">
                Only applies to increases ({increases}). Apple always applies decreases to existing subscribers too. Without preserving, Apple notifies existing subscribers of an increase and may require their consent.
              </p>
            </div>
          ) : (
            <div className="border-(--tag-blue-border) bg-(--tag-blue-bg) text-(--tag-blue-text) flex items-start gap-2 rounded-lg border px-3 py-2.5">
              <Info aria-hidden className="mt-px size-3.5 shrink-0" />
              <p className="caption-style leading-[1.45]">
                In-app purchase prices are saved as one schedule. Existing manual prices are kept, the base territory stays {territoryInfo(baseTerritory ?? "USA").name}, and the selected storefronts switch to manual prices.
              </p>
            </div>
          )}

          <ul className="border-border caption-style text-soft flex max-h-[180px] flex-col gap-1.5 overflow-y-auto rounded-lg border p-3">
            {rows.map((r) => (
              <li key={r.territory} className="flex justify-between gap-2">
                <span>
                  {territoryInfo(r.territory).flag} {territoryInfo(r.territory).name}
                </span>
                <span className="tabular-nums">
                  {r.current ?? "—"} → {r.proposed} {r.currency}
                </span>
              </li>
            ))}
          </ul>

          {running && (
            <div className="flex flex-col gap-2" role="progressbar" aria-valuemin={0} aria-valuemax={running.total} aria-valuenow={running.done}>
              <span className="caption-style text-soft">
                {running.done} of {running.total} processed…
              </span>
              <span className="bg-track block h-1 overflow-hidden rounded-full">
                <span className="bg-status block h-full rounded-full transition-[width] duration-300" style={{ width: `${(running.done / Math.max(1, running.total)) * 100}%` }} />
              </span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" size="md" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" size="md" disabled={busy || !rows.length || !customValid} onClick={() => void onConfirm({ startMode, customDate, preserve })}>
            {busy && <Loader2 aria-hidden className="size-3.5 animate-spin" />}
            Schedule in App Store Connect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
