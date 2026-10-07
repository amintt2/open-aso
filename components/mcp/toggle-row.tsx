"use client";

import type { ReactNode } from "react";
import { Switch } from "radix-ui";
import { cn } from "@/lib/utils";

export default function ToggleRow({
  id,
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  description: ReactNode;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <label htmlFor={id} className="font-medium">
          {label}
        </label>
        <p id={`${id}-description`} className="caption-style text-subtle">
          {description}
        </p>
      </div>
      <Switch.Root
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
        aria-describedby={`${id}-description`}
        className={cn(
          "focus-visible:ring-ring/60 relative mt-0.5 inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-(--line-strong) bg-[#2a2a2a] transition-colors duration-150 outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
          "data-[state=checked]:border-(--tag-green-border) data-[state=checked]:bg-(--trend)",
        )}
      >
        <Switch.Thumb className="block size-3.5 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform duration-150 data-[state=checked]:translate-x-[17px]" />
      </Switch.Root>
    </div>
  );
}
