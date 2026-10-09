import { cn } from "@/lib/utils";

export default function Sparkline({
  values,
  color = "#16c89e",
  className,
  label,
}: {
  values: (number | null)[];
  color?: string;
  className?: string;
  label?: string;
}) {
  const nums = values.filter((v): v is number => v != null);
  const width = 120;
  const height = 32;
  if (nums.length < 2)
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className={cn("h-8 w-full", className)}
        role="img"
        aria-label={label ?? "Not enough history"}
      >
        <line
          x1="0"
          x2={width}
          y1={height - 2}
          y2={height - 2}
          stroke="#2a2a2a"
          strokeDasharray="3 3"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    );
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min || 1;
  const step = width / Math.max(1, values.length - 1);
  const y = (v: number) => height - 3 - ((v - min) / span) * (height - 6);
  const segments: string[] = [];
  let current = "";
  values.forEach((v, i) => {
    if (v == null) {
      if (current) segments.push(current);
      current = "";
      return;
    }
    current += `${current ? "L" : "M"}${(i * step).toFixed(1)},${y(v).toFixed(1)}`;
  });
  if (current) segments.push(current);
  const firstIndex = values.findIndex((v) => v != null);
  const lastIndex =
    values.length - 1 - [...values].reverse().findIndex((v) => v != null);
  const area = `${segments.join("")}L${(lastIndex * step).toFixed(1)},${height}L${(firstIndex * step).toFixed(1)},${height}Z`;
  const gradient = `spark-${color.replace("#", "")}`;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn("h-8 w-full", className)}
      role="img"
      aria-label={label ?? "Trend"}
    >
      <defs>
        <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {segments.length === 1 && <path d={area} fill={`url(#${gradient})`} />}
      {segments.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}
