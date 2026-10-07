"use client";

import { useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Eye, Hourglass, Pause, Pencil, Play, Search, Minus } from "lucide-react";
import Tag from "@/components/_ui/tag";
import Button from "@/components/_ui/button";
import { Input } from "@/components/_ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/_ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/_ui/dialog";
import { cn } from "@/lib/utils";
import type { Diagnosis, RangeDays } from "@/lib/apple-ads/types";
import { RANGE_OPTIONS } from "@/lib/apple-ads/types";
import { money } from "./format";

export function InlineMoney({ value, currency, onCommit, disabled, label, muted }: { value: number; currency: string; onCommit: (next: number) => void; disabled?: boolean; label: string; muted?: boolean }) {
  const [draft, setDraft] = useState<string | null>(null);
  if (draft !== null)
    return (
      <Input
        autoFocus
        aria-label={label}
        inputMode="decimal"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const n = Number(draft.replace(",", "."));
          setDraft(null);
          if (Number.isFinite(n) && n > 0 && Math.abs(n - value) >= 0.005) onCommit(Math.round(n * 100) / 100);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setDraft(null);
        }}
        className="h-7 w-24 px-2 text-[13px] tabular-nums"
      />
    );
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={`Edit ${label}`}
      onClick={() => setDraft(value.toFixed(2))}
      className={cn("group hover:bg-white/6 -mx-1.5 inline-flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 tabular-nums transition-colors disabled:cursor-default disabled:hover:bg-transparent", muted && "text-subtle")}
    >
      {money(value, currency)}
      {!disabled && <Pencil aria-hidden className="text-subtle size-3 opacity-0 transition-opacity group-hover:opacity-100" />}
    </button>
  );
}

export function StatusToggle({ active, onToggle, label }: { active: boolean; onToggle: () => void; label: string }) {
  return (
    <Button variant="ghost" size="icon-sm" aria-label={`${active ? "Pause" : "Enable"} ${label}`} title={active ? "Pause" : "Enable"} onClick={onToggle}>
      {active ? <Pause aria-hidden className="size-3.5" /> : <Play aria-hidden className="size-3.5" />}
    </Button>
  );
}

export function StatusTag({ status, display }: { status: string; display?: string | null }) {
  const s = (display ?? status).toUpperCase();
  const tone = s === "RUNNING" || s === "ENABLED" || s === "ACTIVE" ? "green" : s.includes("PAUSE") ? "neutral" : s === "ON_HOLD" ? "amber" : "red";
  const label = s.replaceAll("_", " ").toLowerCase();
  return (
    <Tag tone={tone} size="sm" className="caption-style capitalize">
      {label}
    </Tag>
  );
}

const DIAG: Record<Diagnosis["action"], { tone: "green" | "red" | "amber" | "neutral" | "blue" | "purple"; icon: typeof ArrowUp; label: string }> = {
  raise: { tone: "green", icon: ArrowUp, label: "Raise" },
  lower: { tone: "amber", icon: ArrowDown, label: "Lower" },
  pause: { tone: "red", icon: Pause, label: "Pause" },
  review: { tone: "purple", icon: Eye, label: "Review" },
  wait: { tone: "blue", icon: Hourglass, label: "Learning" },
  hold: { tone: "neutral", icon: Minus, label: "Hold" },
};

export function DiagnosisBadge({ diagnosis }: { diagnosis: Diagnosis }) {
  const d = DIAG[diagnosis.action];
  const Icon = d.icon;
  return (
    <Tag tone={d.tone} size="sm" className="caption-style cursor-help gap-1" title={`${diagnosis.rule}: ${diagnosis.why}`}>
      <Icon aria-hidden className="size-3" />
      {d.label}
    </Tag>
  );
}

export function RangePicker({ value, onChange }: { value: RangeDays; onChange: (d: RangeDays) => void }) {
  return (
    <div role="radiogroup" aria-label="Date range" className="bg-secondary flex items-center rounded-full p-0.5 shadow-[0px_0px_0px_1px_rgba(0,0,0,0.4),inset_0px_1px_0px_0px_rgba(255,255,255,0.06)]">
      {RANGE_OPTIONS.map((d) => (
        <button
          key={d}
          type="button"
          role="radio"
          aria-checked={value === d}
          onClick={() => onChange(d)}
          className={cn("caption-style text-subtle hover:text-foreground h-[26px] cursor-pointer rounded-full px-2.5 transition-colors", value === d && "bg-muted text-foreground")}
        >
          {d}d
        </button>
      ))}
    </div>
  );
}

export function SearchMatchTag({ on }: { on: boolean }) {
  return (
    <Tag tone={on ? "purple" : "neutral"} size="sm" className="caption-style gap-1">
      <Search aria-hidden className="size-3" />
      {on ? "On" : "Off"}
    </Tag>
  );
}

export function DetailSheet({
  open,
  onOpenChange,
  title,
  description,
  actions,
  children,
  width = "sm:max-w-[1040px]",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  width?: string;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className={cn("w-full", width)}>
        <SheetHeader className="h-auto min-h-14 flex-wrap py-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <SheetTitle className="truncate">{title}</SheetTitle>
            <SheetDescription className={cn(!description && "sr-only")}>{description ?? "Details"}</SheetDescription>
          </div>
          <div className="flex items-center gap-2">
            {actions}
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <div role="alert" className="border-(--tag-red-border) bg-(--tag-red-bg) text-(--tag-red-text) m-4 rounded-lg border p-3 text-[13px]">
      {error instanceof Error ? error.message : String(error)}
    </div>
  );
}

export function LoadingRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2 p-4" aria-busy>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="bg-secondary h-9 animate-pulse rounded-md" />
      ))}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex min-w-[96px] flex-col gap-1.5">
      <span className="caption-style text-subtle">{label}</span>
      <span className="text-[15px] tabular-nums">{value}</span>
      {hint && <span className="caption-style text-subtle">{hint}</span>}
    </div>
  );
}

export function ConfirmDialog({ open, title, description, confirmLabel, onConfirm, onCancel }: { open: boolean; title: string; description: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-[440px]">
        <DialogHeader className="pr-12">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" size="md" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" size="md" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
