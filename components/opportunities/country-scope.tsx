"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import Button from "@/components/_ui/button";
import { Checkbox } from "@/components/_ui/checkbox";
import { Input } from "@/components/_ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/_ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/_ui/select";
import { COUNTRIES } from "@/lib/appstore/countries";
import { ALL_COUNTRY_CODES, REGIONS, type RegionId } from "@/lib/opportunities/regions";
import { cn } from "@/lib/utils";

export type Scope = { mode: "all" | "region" | "custom"; region: RegionId; custom: string[] };

export function scopeCountries(scope: Scope): string[] {
  if (scope.mode === "all") return ALL_COUNTRY_CODES;
  if (scope.mode === "region") return REGIONS.find((r) => r.id === scope.region)?.countries ?? [];
  return scope.custom;
}

const MODES: { id: Scope["mode"]; label: string }[] = [
  { id: "all", label: `All ${ALL_COUNTRY_CODES.length}` },
  { id: "region", label: "Region" },
  { id: "custom", label: "Custom" },
];

function CustomPicker({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const [query, setQuery] = useState("");
  const selected = new Set(value);
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? COUNTRIES.filter((c) => c.name.toLowerCase().includes(q) || c.code === q) : COUNTRIES;
  }, [query]);

  function toggle(code: string, on: boolean) {
    const next = new Set(selected);
    if (on) next.add(code);
    else next.delete(code);
    onChange([...next]);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="md" className="h-9 justify-between rounded-lg px-3 font-normal" aria-label="Choose countries">
          {value.length ? `${value.length} ${value.length === 1 ? "country" : "countries"}` : "Choose countries"}
          <ChevronDown aria-hidden className="text-subtle size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-[300px] flex-col">
        <div className="border-border border-b p-2">
          <div className="relative">
            <Search aria-hidden className="text-subtle absolute top-1/2 left-3 size-3.5 -translate-y-1/2" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search countries" aria-label="Search countries" className="pl-8" />
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {REGIONS.map((r) => (
              <Button key={r.id} variant="subtle" size="sm" onClick={() => onChange([...new Set([...value, ...r.countries])])}>
                + {r.label}
              </Button>
            ))}
            <Button variant="ghost" size="sm" onClick={() => onChange([])} disabled={!value.length}>
              Clear
            </Button>
          </div>
        </div>
        <ul className="max-h-[280px] overflow-y-auto p-1">
          {list.map((c) => {
            const id = `scope-${c.code}`;
            return (
              <li key={c.code}>
                <label htmlFor={id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[14px] hover:bg-white/5">
                  <Checkbox id={id} checked={selected.has(c.code)} onCheckedChange={(v) => toggle(c.code, v === true)} />
                  <span aria-hidden>{c.flag}</span>
                  <span className="truncate">{c.name}</span>
                </label>
              </li>
            );
          })}
          {!list.length && <li className="text-subtle px-2 py-3">No match</li>}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

export default function CountryScope({ value, onChange }: { value: Scope; onChange: (next: Scope) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div role="radiogroup" aria-label="Country scope" className="bg-secondary border-line-strong flex h-9 items-center gap-0.5 rounded-lg border p-0.5">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={value.mode === m.id}
            onClick={() => onChange({ ...value, mode: m.id })}
            className={cn(
              "focus-visible:ring-ring/60 h-full cursor-pointer rounded-md px-3 text-[13px] transition-colors duration-150 outline-none focus-visible:ring-2",
              value.mode === m.id ? "bg-muted text-foreground" : "text-subtle hover:text-foreground",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>
      {value.mode === "region" && (
        <Select value={value.region} onValueChange={(region) => onChange({ ...value, region: region as RegionId })}>
          <SelectTrigger aria-label="Region" className="w-auto min-w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REGIONS.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.label} ({r.countries.length})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {value.mode === "custom" && <CustomPicker value={value.custom} onChange={(custom) => onChange({ ...value, custom })} />}
    </div>
  );
}
