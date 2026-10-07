import { cn } from "@/lib/utils";

type SegmentTone = "auto" | "danger" | "warning" | "success";

type SegmentBarProps = {
  percent: number;
  segments?: number;
  tone?: SegmentTone;
  className?: string;
  segmentClassName?: string;
  trackClassName?: string;
};

const TONE_CLASS: Record<Exclude<SegmentTone, "auto">, string> = {
  danger: "bg-danger",
  warning: "bg-warning",
  success: "bg-success",
};

function autoTone(index: number, filled: number) {
  const red = Math.floor(filled / 3);
  const amber = Math.ceil(filled / 3);
  if (index < red) return TONE_CLASS.danger;
  if (index < red + amber) return TONE_CLASS.warning;
  return TONE_CLASS.success;
}

export default function SegmentBar({
  percent,
  segments = 17,
  tone = "auto",
  className,
  segmentClassName,
  trackClassName = "bg-track",
}: SegmentBarProps) {
  const filled = Math.round((percent / 100) * segments);

  return (
    <span
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={cn(
        "flex h-[14px] items-center gap-[2px] overflow-hidden rounded-[2px] bg-white/8 px-[2px]",
        className,
      )}
    >
      {Array.from({ length: segments }, (_, index) => (
        <span
          key={index}
          className={cn(
            "h-[10px] min-w-px flex-1 rounded-[1px]",
            segmentClassName,
            index < filled
              ? tone === "auto"
                ? autoTone(index, filled)
                : TONE_CLASS[tone]
              : trackClassName,
          )}
        />
      ))}
    </span>
  );
}
