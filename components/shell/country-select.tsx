"use client";

import { Globe } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/_ui/select";
import { COUNTRIES } from "@/lib/appstore/countries";
import { cn } from "@/lib/utils";

export default function CountrySelect({
  value,
  onChange,
  only,
  allOption,
  className,
}: {
  value: string;
  onChange: (code: string) => void;
  only?: string[];
  allOption?: { value: string; label: string };
  className?: string;
}) {
  const list = only?.length ? COUNTRIES.filter((c) => only.includes(c.code)) : COUNTRIES;
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label="Country" className={cn("h-[30px] w-auto min-w-[150px] rounded-full text-[13px]", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-[360px]">
        {allOption && (
          <SelectItem value={allOption.value} className="border-line-strong mb-1 border-b">
            <Globe aria-hidden className="text-subtle mr-1.5 inline size-3.5 align-[-2px]" />
            {allOption.label}
          </SelectItem>
        )}
        {list.map((c) => (
          <SelectItem key={c.code} value={c.code}>
            <span className="mr-1.5">{c.flag}</span>
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
