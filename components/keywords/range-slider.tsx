"use client";

import { Slider as SliderPrimitive } from "radix-ui";

export default function RangeSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: [number, number];
  onChange: (v: [number, number]) => void;
}) {
  return (
    <SliderPrimitive.Root
      aria-label={label}
      min={0}
      max={100}
      step={1}
      minStepsBetweenThumbs={1}
      value={value}
      onValueChange={(v) => onChange([v[0], v[1]])}
      className="relative flex h-5 w-full touch-none items-center select-none"
    >
      <SliderPrimitive.Track className="bg-track relative h-1.5 grow overflow-hidden rounded-full">
        <SliderPrimitive.Range className="bg-soft absolute h-full rounded-full" />
      </SliderPrimitive.Track>
      {(["Minimum", "Maximum"] as const).map((edge) => (
        <SliderPrimitive.Thumb
          key={edge}
          aria-label={`${edge} ${label.toLowerCase()}`}
          className="bg-foreground ease-power3-out block size-4 cursor-grab rounded-full shadow-[0px_2px_6px_0px_rgba(0,0,0,0.5),0px_0px_0px_1px_rgba(0,0,0,0.4)] transition-[box-shadow] duration-150 outline-none focus-visible:shadow-[0px_2px_6px_0px_rgba(0,0,0,0.5),0px_0px_0px_4px_rgba(255,255,255,0.12)] active:cursor-grabbing"
        />
      ))}
    </SliderPrimitive.Root>
  );
}
