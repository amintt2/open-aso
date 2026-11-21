"use client";

import type { ReactNode } from "react";
import { Skeleton } from "./widget";

export function TileSkeletons({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          role="status"
          aria-label="Loading"
          className="bg-card border-border flex flex-col gap-3 rounded-xl border p-4"
        >
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </>
  );
}

export function Caption({ children }: { children: ReactNode }) {
  return <span className="caption-style text-subtle truncate">{children}</span>;
}
