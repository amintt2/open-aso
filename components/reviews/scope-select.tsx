"use client";

import { Globe2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/_ui/select";
import { COUNTRIES } from "@/lib/appstore/countries";
import { cn } from "@/lib/utils";

export default function ScopeSelect({ value, onChange, className }: { value: string; onChange: (scope: string) => void; className?: string }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label="Storefront" className={cn("h-[30px] w-auto min-w-[170px] rounded-full text-[13px]", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-[360px]">
        <SelectItem value="all">
          <Globe2 aria-hidden className="mr-1.5 inline size-3.5 align-[-2px]" />
          All major countries
        </SelectItem>
        {COUNTRIES.map((c) => (
          <SelectItem key={c.code} value={c.code}>
            <span className="mr-1.5">{c.flag}</span>
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
