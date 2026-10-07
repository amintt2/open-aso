import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export default function Stat({ label, value, hint, className }: { label: string; value: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <div className={cn("bg-card border-border flex min-w-0 flex-col gap-2 rounded-lg border px-3 py-2.5", className)}>
      <span className="caption-style text-subtle truncate">{label}</span>
      <span className="lead-style truncate tabular-nums">{value}</span>
      {hint && <span className="caption-style text-faint truncate">{hint}</span>}
    </div>
  );
}
