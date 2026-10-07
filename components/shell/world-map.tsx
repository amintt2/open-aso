"use client";

import { useMemo, useState } from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { Topology, GeometryCollection } from "topojson-specification";
import world from "world-atlas/countries-110m.json";
import { ALPHA2_BY_NUMERIC } from "@/lib/appstore/iso-numeric";
import { COUNTRY_BY_CODE } from "@/lib/appstore/countries";
import { cn } from "@/lib/utils";

type Props = {
  values: Record<string, number | null | undefined>;
  format?: (value: number) => string;
  invert?: boolean;
  selected?: string | null;
  onSelect?: (code: string) => void;
  className?: string;
  legend?: string;
};

const WIDTH = 960;
const HEIGHT = 480;

const collection = feature(
  world as unknown as Topology,
  (world as unknown as Topology).objects.countries as GeometryCollection,
) as unknown as FeatureCollection<Geometry, { name: string }>;

const features = collection.features.filter((f) => f.properties?.name !== "Antarctica");
const projection = geoNaturalEarth1().fitSize([WIDTH, HEIGHT], { type: "FeatureCollection", features } as FeatureCollection);
const path = geoPath(projection);
const shapes = features.map((f: Feature<Geometry, { name: string }>) => ({
  d: path(f) ?? "",
  code: ALPHA2_BY_NUMERIC[String(f.id).padStart(3, "0")] ?? null,
  name: f.properties?.name ?? "",
}));

function color(t: number) {
  const a = [57, 94, 77];
  const b = [34, 197, 94];
  const mix = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${mix.join(",")})`;
}

export default function WorldMap({ values, format = (v) => String(Math.round(v)), invert = false, selected, onSelect, className, legend }: Props) {
  const [hover, setHover] = useState<{ code: string | null; name: string; x: number; y: number } | null>(null);
  const nums = Object.values(values).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const min = nums.length ? Math.min(...nums) : 0;
  const max = nums.length ? Math.max(...nums) : 1;
  const scale = useMemo(
    () => (v: number) => {
      const t = max === min ? 1 : (v - min) / (max - min);
      return invert ? 1 - t : t;
    },
    [min, max, invert],
  );
  const hoverValue = hover?.code ? values[hover.code] : undefined;

  return (
    <div className={cn("relative w-full", className)}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" role="img" aria-label={legend ?? "World map"}>
        {shapes.map((s, i) => {
          const v = s.code ? values[s.code] : undefined;
          const has = typeof v === "number" && Number.isFinite(v);
          const supported = s.code ? COUNTRY_BY_CODE.has(s.code) : false;
          return (
            <path
              key={i}
              d={s.d}
              fill={has ? color(scale(v as number)) : supported ? "#2a2a2a" : "#1e1e1e"}
              stroke={selected && s.code === selected ? "#f9fbff" : "#161616"}
              strokeWidth={selected && s.code === selected ? 1.5 : 0.5}
              className={cn("transition-opacity duration-150", onSelect && s.code && "cursor-pointer hover:opacity-80")}
              onMouseMove={(e) => {
                const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                setHover({ code: s.code, name: s.code ? (COUNTRY_BY_CODE.get(s.code)?.name ?? s.name) : s.name, x: e.clientX - rect.left, y: e.clientY - rect.top });
              }}
              onMouseLeave={() => setHover(null)}
              onClick={() => s.code && onSelect?.(s.code)}
            />
          );
        })}
      </svg>
      {hover && (
        <div className="bg-popover border-line-strong shadow-overlay caption-style pointer-events-none absolute z-10 flex -translate-x-1/2 -translate-y-[calc(100%+8px)] flex-col gap-1 rounded-md border px-2 py-1.5 whitespace-nowrap" style={{ left: hover.x, top: hover.y }}>
          <span className="text-foreground">{hover.name}</span>
          <span className="text-subtle">{typeof hoverValue === "number" ? format(hoverValue) : "No data"}</span>
        </div>
      )}
      {legend && nums.length > 0 && (
        <div className="caption-style text-subtle mt-2 flex items-center gap-2">
          <span>{legend}</span>
          <span>{format(invert ? max : min)}</span>
          <span className="h-1.5 w-24 rounded-full" style={{ background: `linear-gradient(90deg, ${color(0)}, ${color(1)})` }} />
          <span>{format(invert ? min : max)}</span>
        </div>
      )}
    </div>
  );
}
