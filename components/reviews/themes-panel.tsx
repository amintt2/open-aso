"use client";

import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/_ui/tabs";
import type { Review } from "@/lib/client/types";
import { reviewThemes } from "@/lib/reviews/themes";
import type { Theme } from "@/lib/reviews/types";
import { cn } from "@/lib/utils";

type Props = {
  reviews: Review[];
  appName: string;
  active: string;
  onPick: (phrase: string, stars: number[]) => void;
};

function ThemeList({ themes, tone, active, onPick, empty }: { themes: Theme[]; tone: "danger" | "success"; active: string; onPick: (phrase: string) => void; empty: string }) {
  if (!themes.length) return <p className="caption-style text-subtle py-4">{empty}</p>;
  const max = Math.max(...themes.map((t) => t.count));
  return (
    <ul className="flex flex-col gap-0.5 pt-2">
      {themes.map((t) => (
        <li key={t.phrase}>
          <button
            type="button"
            onClick={() => onPick(t.phrase)}
            aria-pressed={active === t.phrase}
            className={cn(
              "flex w-full cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-left outline-none transition-colors duration-150 hover:bg-white/4 focus-visible:ring-2 focus-visible:ring-ring/60",
              active === t.phrase && "bg-white/6",
            )}
          >
            <span className="caption-style min-w-0 flex-1 truncate">{t.phrase}</span>
            <span className="bg-track h-1.5 w-14 shrink-0 overflow-hidden rounded-full">
              <span className={cn("block h-full rounded-full", tone === "danger" ? "bg-danger" : "bg-success")} style={{ width: `${(t.count / max) * 100}%` }} />
            </span>
            <span className="caption-style text-subtle w-14 shrink-0 text-right tabular-nums">
              {t.count} · {Math.round(t.share * 100)}%
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export default function ThemesPanel({ reviews, appName, active, onPick }: Props) {
  const themes = useMemo(() => reviewThemes(reviews, appName), [reviews, appName]);
  const [tab, setTab] = useState("negative");
  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="border-border border-b">
        <TabsTrigger value="negative">Complaints · {themes.lowCount}</TabsTrigger>
        <TabsTrigger value="positive">Praise · {themes.highCount}</TabsTrigger>
      </TabsList>
      <TabsContent value="negative">
        <ThemeList themes={themes.negative} tone="danger" active={active} onPick={(p) => onPick(p, [1, 2])} empty="Not enough 1–2★ reviews to find themes." />
      </TabsContent>
      <TabsContent value="positive">
        <ThemeList themes={themes.positive} tone="success" active={active} onPick={(p) => onPick(p, [4, 5])} empty="Not enough 4–5★ reviews to find themes." />
      </TabsContent>
    </Tabs>
  );
}
