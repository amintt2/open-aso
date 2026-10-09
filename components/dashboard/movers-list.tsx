"use client";

import { useState } from "react";
import Link from "next/link";
import { TrendingDown, TrendingUp } from "lucide-react";
import AppIcon from "@/components/shell/app-icon";
import { Segmented } from "@/components/trends/visibility-chart";
import type { AppRef } from "@/lib/dashboard/types";
import type { TrendMover } from "@/lib/trends/types";
import { cn } from "@/lib/utils";
import { Flag } from "./parts";

type Row = TrendMover & Partial<AppRef>;

const TABS = [
  { key: "gainers", label: "Gainers" },
  { key: "losers", label: "Losers" },
] as const;

function position(p: number | null) {
  return p == null ? "200+" : `#${p}`;
}

export default function MoversList({
  gainers,
  losers,
  hrefFor,
  limit = 6,
}: {
  gainers: Row[];
  losers: Row[];
  hrefFor: (row: Row) => string;
  limit?: number;
}) {
  const [tab, setTab] = useState<"gainers" | "losers">("gainers");
  const rows = (tab === "gainers" ? gainers : losers).slice(0, limit);
  return (
    <div className="flex flex-col gap-3">
      <Segmented
        label="Movers"
        value={tab}
        options={[...TABS]}
        onChange={setTab}
      />
      {!rows.length ? (
        <p className="caption-style text-subtle py-6 text-center">
          {tab === "gainers"
            ? "No keyword climbed in this period."
            : "No keyword dropped in this period."}
        </p>
      ) : (
        <ul className="flex flex-col">
          {rows.map((m) => (
            <li key={m.id}>
              <Link
                href={hrefFor(m)}
                className="-mx-2 flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 transition-colors duration-150 hover:bg-white/4"
              >
                {m.appName && (
                  <AppIcon
                    src={m.iconUrl}
                    name={m.appName}
                    className="size-5"
                  />
                )}
                <Flag code={m.country} className="text-[13px]" />
                <span
                  className="min-w-0 flex-1 truncate text-[13px]"
                  title={m.appName ? `${m.term} · ${m.appName}` : m.term}
                >
                  {m.term}
                </span>
                <span className="caption-style text-subtle shrink-0 tabular-nums">
                  {position(m.startPosition)} →{" "}
                  <span className="text-foreground">
                    {position(m.endPosition)}
                  </span>
                </span>
                <span
                  className={cn(
                    "caption-style inline-flex w-12 shrink-0 items-center justify-end gap-0.5 tabular-nums",
                    m.positionChange > 0 ? "text-trend" : "text-danger",
                  )}
                >
                  {m.positionChange > 0 ? (
                    <TrendingUp aria-hidden className="size-3" />
                  ) : (
                    <TrendingDown aria-hidden className="size-3" />
                  )}
                  {Math.abs(m.positionChange)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
