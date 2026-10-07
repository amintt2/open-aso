"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/_ui/select";
import { cn } from "@/lib/utils";

const OPTIONS = [1, 2, 3, 5, 10];

export default function MinCountriesFilter({ value, max, onChange }: { value: number; max: number; onChange: (n: number) => void }) {
  const options = OPTIONS.filter((n) => n === 1 || n <= Math.max(max, value));
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger
        aria-label="Minimum number of countries"
        className={cn("h-[30px] w-auto min-w-[150px] rounded-full text-[13px]", value > 1 && "text-foreground")}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((n) => (
          <SelectItem key={n} value={String(n)}>
            {n === 1 ? "In any country" : `In ≥ ${n} countries`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
