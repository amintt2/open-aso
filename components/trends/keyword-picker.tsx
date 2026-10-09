"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import Button from "@/components/_ui/button";
import { Checkbox } from "@/components/_ui/checkbox";
import { Input } from "@/components/_ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/_ui/popover";
import type { TrendKeyword } from "@/lib/trends/types";
import { flagOf, keywordLabel } from "./trends-format";

export const MAX_COMPARE = 8;

export default function KeywordPicker({
  keywords,
  selected,
  colors,
  multiCountry,
  onChange,
}: {
  keywords: TrendKeyword[];
  selected: number[];
  colors: Map<number, string>;
  multiCountry: boolean;
  onChange: (ids: number[]) => void;
}) {
  const [query, setQuery] = useState("");
  const chosen = new Set(selected);
  const full = selected.length >= MAX_COMPARE;
  const byId = useMemo(() => new Map(keywords.map((k) => [k.id, k])), [keywords]);
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? keywords.filter((k) => k.term.includes(q) || k.country === q) : keywords;
  }, [keywords, query]);

  function toggle(id: number, on: boolean) {
    if (on && !chosen.has(id) && !full) onChange([...selected, id]);
    if (!on) onChange(selected.filter((s) => s !== id));
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {selected.map((id) => {
        const k = byId.get(id);
        if (!k) return null;
        return (
          <span key={id} className="border-line-strong bg-secondary caption-style text-soft inline-flex h-7 max-w-[220px] items-center gap-1.5 rounded-full border pr-1 pl-2.5">
            <span aria-hidden className="size-2 shrink-0 rounded-[2px]" style={{ background: colors.get(id) }} />
            <span className="truncate">{keywordLabel(k, multiCountry)}</span>
            <Button variant="ghost" size="icon-sm" className="size-5" aria-label={`Remove ${k.term}`} onClick={() => toggle(id, false)}>
              <X aria-hidden className="size-3" />
            </Button>
          </span>
        );
      })}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="secondary" size="sm" className="h-7" aria-label="Choose keywords to compare">
            {selected.length ? `${selected.length}/${MAX_COMPARE}` : "Choose keywords"}
            <ChevronDown aria-hidden className="text-subtle size-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="flex w-[300px] flex-col">
          <div className="border-border flex flex-col gap-2 border-b p-2">
            <div className="relative">
              <Search aria-hidden className="text-subtle absolute top-1/2 left-3 size-3.5 -translate-y-1/2" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search keywords" aria-label="Search keywords" className="pl-8" />
            </div>
            <div className="flex items-center justify-between">
              <span className="caption-style text-subtle">{full ? `Up to ${MAX_COMPARE} keywords` : `${selected.length} of ${MAX_COMPARE} selected`}</span>
              <Button variant="ghost" size="sm" onClick={() => onChange([])} disabled={!selected.length}>
                Clear
              </Button>
            </div>
          </div>
          <ul className="max-h-[280px] overflow-y-auto p-1">
            {list.map((k) => {
              const id = `compare-${k.id}`;
              const on = chosen.has(k.id);
              return (
                <li key={k.id}>
                  <label htmlFor={id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[14px] hover:bg-white/5 has-disabled:cursor-not-allowed has-disabled:opacity-50">
                    <Checkbox id={id} checked={on} disabled={!on && full} onCheckedChange={(v) => toggle(k.id, v === true)} />
                    {multiCountry && <span aria-hidden>{flagOf(k.country)}</span>}
                    <span className="truncate">{k.term}</span>
                  </label>
                </li>
              );
            })}
            {!list.length && <li className="text-subtle px-2 py-3">No match</li>}
          </ul>
        </PopoverContent>
      </Popover>
    </div>
  );
}
