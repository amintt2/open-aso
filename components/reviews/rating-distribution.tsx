"use client";

import type { Review } from "@/lib/client/types";
import { cn } from "@/lib/utils";

export default function RatingDistribution({ reviews, selected, onToggle }: { reviews: Review[]; selected: number[]; onToggle: (star: number) => void }) {
  const counts = [5, 4, 3, 2, 1].map((star) => ({ star, count: reviews.filter((r) => r.rating === star).length }));
  const max = Math.max(1, ...counts.map((c) => c.count));
  return (
    <ul className="flex flex-col gap-1" aria-label="Rating distribution">
      {counts.map(({ star, count }) => {
        const active = selected.includes(star);
        const share = reviews.length ? count / reviews.length : 0;
        return (
          <li key={star}>
            <button
              type="button"
              aria-pressed={active}
              onClick={() => onToggle(star)}
              className={cn(
                "flex w-full cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 outline-none transition-colors duration-150 hover:bg-white/4 focus-visible:ring-2 focus-visible:ring-ring/60",
                active && "bg-white/6",
              )}
            >
              <span className="caption-style text-soft w-6 shrink-0 text-left tabular-nums">{star}★</span>
              <span className="bg-track h-2 flex-1 overflow-hidden rounded-full">
                <span
                  className={cn("block h-full rounded-full", star >= 4 ? "bg-success" : star === 3 ? "bg-warning" : "bg-danger")}
                  style={{ width: `${(count / max) * 100}%` }}
                />
              </span>
              <span className="caption-style text-subtle w-16 shrink-0 text-right tabular-nums">
                {count} · {Math.round(share * 100)}%
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
