import { cn } from "@/lib/utils";

type SparklineProps = {
  values: (number | null)[];
  invert?: boolean;
  className?: string;
};

export default function Sparkline({ values, invert = false, className }: SparklineProps) {
  const nums = values.filter((v): v is number => v != null);
  if (nums.length < 2) return <span aria-hidden className={cn("text-subtle caption-style", className)}>—</span>;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min || 1;
  const w = 64;
  const h = 18;
  const step = w / (values.length - 1);
  const points = values
    .map((v, i) => (v == null ? null : `${(i * step).toFixed(1)},${(invert ? ((v - min) / span) * h : h - ((v - min) / span) * h).toFixed(1)}`))
    .filter(Boolean)
    .join(" ");
  const first = nums[0];
  const last = nums[nums.length - 1];
  const up = invert ? last < first : last > first;
  return (
    <svg aria-hidden viewBox={`-1 -1 ${w + 2} ${h + 2}`} className={cn("h-[18px] w-16", className)}>
      <polyline points={points} fill="none" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" className={up ? "stroke-trend" : last === first ? "stroke-subtle" : "stroke-danger"} />
    </svg>
  );
}
