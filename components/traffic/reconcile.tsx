import { shortDate } from "@/components/analytics/chart-kit";
import { formatCompact } from "@/lib/client/format";
import type { TrafficReconcile } from "@/lib/traffic/types";

function pct(a: number, b: number) {
  if (!b) return null;
  const change = (a - b) / b;
  return `${change >= 0 ? "+" : "−"}${Math.abs(change * 100).toFixed(0)}%`;
}

function Line({ item }: { item: TrafficReconcile }) {
  const span = `Same ${item.days} days (${shortDate(item.from)} – ${shortDate(item.to)})`;
  if (item.kind === "opens") {
    const gap = pct(item.opens, item.downloads);
    return (
      <li>
        <span className="text-soft">
          {span}: PostHog counted {formatCompact(item.opens)} first opens vs Apple {formatCompact(item.downloads)} first-time downloads{gap ? ` (${gap})` : ""}.
        </span>{" "}
        {item.opens >= item.downloads
          ? "PostHog also counts TestFlight, App Review and reinstalled devices; Apple counts first-time downloads only."
          : "Some people download without opening the app, or block tracking; Apple stays the reference for installs."}
      </li>
    );
  }
  const ratio = item.apple > 0 ? item.estimated / item.apple : null;
  return (
    <li>
      <span className="text-soft">
        {span}: the rankings model estimated ~{formatCompact(Math.round(item.estimated))} search installs vs {formatCompact(item.apple)} first-time downloads Apple attributes to App Store search
        {ratio == null ? "" : ` (model = ${Math.round(ratio * 100)}% of Apple)`}.
      </span>{" "}
      The model is scaled to match Apple&apos;s search downloads over the last 14 days, so the totals stay close by design; what it adds is the split by keyword, country and position. Older days can drift when your ranks change.
    </li>
  );
}

export default function Reconcile({ items }: { items: TrafficReconcile[] }) {
  if (!items.length) return null;
  return (
    <ul aria-label="How the sources compare" className="caption-style text-subtle flex flex-col gap-1.5">
      {items.map((item) => (
        <Line key={item.kind} item={item} />
      ))}
    </ul>
  );
}
