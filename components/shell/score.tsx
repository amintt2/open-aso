import Tag from "@/components/_ui/tag";
import { LABEL_TONE, type TargetingLabel } from "@/lib/aso/scoring";
import { cn } from "@/lib/utils";

function tone(value: number, invert: boolean) {
  const v = invert ? 100 - value : value;
  if (v >= 60) return "bg-success";
  if (v >= 35) return "bg-warning";
  return "bg-danger";
}

export function ScoreBar({ value, invert = false, className }: { value: number | null | undefined; invert?: boolean; className?: string }) {
  if (value == null) return <span className="text-subtle">—</span>;
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="w-6 text-right tabular-nums">{Math.round(value)}</span>
      <span className="bg-track h-1.5 w-12 overflow-hidden rounded-full">
        <span className={cn("block h-full rounded-full", tone(value, invert))} style={{ width: `${Math.max(4, value)}%` }} />
      </span>
    </span>
  );
}

export function LabelTag({ label }: { label: TargetingLabel | null | undefined }) {
  if (!label) return <span className="text-subtle">—</span>;
  return (
    <Tag tone={LABEL_TONE[label]} size="sm" className="text-[12px]">
      {label}
    </Tag>
  );
}

export function PositionBadge({ position, change }: { position: number | null | undefined; change?: number | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums">
      <span className={cn(position == null && "text-subtle")}>{position == null ? "200+" : `#${position}`}</span>
      {change != null && change !== 0 && (
        <span className={cn("caption-style", change > 0 ? "text-trend" : "text-danger")}>
          {change > 0 ? "▲" : "▼"}
          {Math.abs(change)}
        </span>
      )}
    </span>
  );
}
