"use client";

import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { Input } from "@/components/_ui/input";
import { Label } from "@/components/_ui/label";
import { textareaClass } from "@/components/asc/asc-setup-sheet";
import { cn } from "@/lib/utils";
import { charCount } from "./keyword-utils";

export function CharCounter({ value, limit, className }: { value: string; limit: number; className?: string }) {
  const n = charCount(value);
  const tone = n > limit ? "text-danger" : n >= limit * 0.9 ? "text-warning" : "text-subtle";
  return (
    <span className={cn("caption-style tabular-nums", tone, className)} aria-live="polite">
      {n}/{limit}
    </span>
  );
}

export function UsageBar({ value, limit }: { value: number; limit: number }) {
  const pct = Math.min(100, (value / limit) * 100);
  const tone = value > limit ? "bg-danger" : value >= limit * 0.9 ? "bg-success" : value >= limit * 0.6 ? "bg-warning" : "bg-faint";
  return (
    <span className="bg-track block h-1 w-full overflow-hidden rounded-full">
      <span className={cn("block h-full rounded-full", tone)} style={{ width: `${pct}%` }} />
    </span>
  );
}

type Props = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  limit?: number;
  multiline?: boolean;
  rows?: number;
  disabled?: boolean;
  lockedReason?: string;
  dirty?: boolean;
  placeholder?: string;
  hint?: ReactNode;
  children?: ReactNode;
  type?: string;
};

export default function CharField({ id, label, value, onChange, limit, multiline, rows = 6, disabled, lockedReason, dirty, placeholder, hint, children, type }: Props) {
  const over = limit !== undefined && charCount(value) > limit;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="flex items-center gap-1.5">
          {label}
          {dirty && <span className="bg-status size-1.5 rounded-full" aria-label="edited" />}
          {disabled && lockedReason && (
            <span className="text-subtle inline-flex items-center gap-1" title={lockedReason}>
              <Lock aria-hidden className="size-3" />
              <span className="sr-only">{lockedReason}</span>
            </span>
          )}
        </Label>
        {limit !== undefined && <CharCounter value={value} limit={limit} />}
      </div>
      {multiline ? (
        <textarea
          id={id}
          value={value}
          rows={rows}
          disabled={disabled}
          placeholder={placeholder}
          aria-invalid={over}
          onChange={(e) => onChange(e.target.value)}
          className={cn(textareaClass, "resize-y", over && "border-danger")}
        />
      ) : (
        <Input id={id} type={type} value={value} disabled={disabled} placeholder={placeholder} aria-invalid={over} onChange={(e) => onChange(e.target.value)} className={cn(over && "border-danger")} />
      )}
      {children}
      {hint && <span className="caption-style text-subtle leading-[1.4]">{hint}</span>}
    </div>
  );
}
