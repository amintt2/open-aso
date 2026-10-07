"use client";

import { ListFilter } from "lucide-react";
import Button from "@/components/_ui/button";
import { Checkbox } from "@/components/_ui/checkbox";
import CountBadge from "@/components/_ui/count-badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/_ui/popover";
import { LabelTag } from "@/components/shell/score";
import RangeSlider from "./range-slider";
import {
  activeFilterCount,
  DEFAULT_FILTERS,
  TARGETING_LABELS,
  type Filters,
} from "@/lib/keywords/table";

function RangeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: [number, number];
  onChange: (v: [number, number]) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <span className="caption-style text-soft">{label}</span>
        <span className="caption-style text-subtle tabular-nums">
          {value[0]}–{value[1]}
        </span>
      </div>
      <RangeSlider label={label} value={value} onChange={onChange} />
    </div>
  );
}

function ToggleRow({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-2">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
      />
      <span className="caption-style text-foreground">{label}</span>
    </label>
  );
}

export default function KeywordFilters({
  value,
  onChange,
}: {
  value: Filters;
  onChange: (f: Filters) => void;
}) {
  const count = activeFilterCount(value);
  const toggleLabel = (label: (typeof TARGETING_LABELS)[number]) =>
    onChange({
      ...value,
      labels: value.labels.includes(label)
        ? value.labels.filter((l) => l !== label)
        : [...value.labels, label],
    });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          className="h-[30px]"
          aria-label={count ? `Filters, ${count} active` : "Filters"}
        >
          <ListFilter aria-hidden className="size-3.5" />
          Filters
          {count > 0 && <CountBadge>{count}</CountBadge>}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="flex w-[300px] flex-col gap-4 p-4"
      >
        <div className="flex items-center justify-between">
          <span className="lead-style font-medium">Filters</span>
          <Button
            variant="ghost"
            size="sm"
            disabled={!count}
            onClick={() => onChange(DEFAULT_FILTERS)}
          >
            Reset
          </Button>
        </div>
        <div className="flex flex-col gap-2.5">
          <span className="caption-style text-soft">Targeting label</span>
          <div className="flex flex-wrap gap-1.5">
            {TARGETING_LABELS.map((label) => {
              const on = value.labels.includes(label);
              return (
                <button
                  key={label}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleLabel(label)}
                  className="focus-visible:ring-ring/60 cursor-pointer rounded-full opacity-45 transition-opacity duration-150 outline-none hover:opacity-80 focus-visible:ring-2 aria-pressed:opacity-100"
                >
                  <LabelTag label={label} />
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-col gap-2.5">
          <ToggleRow
            id="kw-filter-liked"
            label="Liked only"
            checked={value.likedOnly}
            onChange={(likedOnly) => onChange({ ...value, likedOnly })}
          />
          <ToggleRow
            id="kw-filter-ranked"
            label="Ranked only (top 200)"
            checked={value.rankedOnly}
            onChange={(rankedOnly) => onChange({ ...value, rankedOnly })}
          />
          <ToggleRow
            id="kw-filter-unrelated"
            label="Hide unrelated"
            checked={value.hideUnrelated ?? false}
            onChange={(hideUnrelated) => onChange({ ...value, hideUnrelated })}
          />
        </div>
        <RangeField
          label="Popularity"
          value={value.popularity}
          onChange={(popularity) => onChange({ ...value, popularity })}
        />
        <RangeField
          label="Difficulty"
          value={value.difficulty}
          onChange={(difficulty) => onChange({ ...value, difficulty })}
        />
      </PopoverContent>
    </Popover>
  );
}
