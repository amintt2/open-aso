"use client";

import type { ComponentProps } from "react";
import { Slider as SliderPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

function Slider({
  className,
  ...props
}: ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      className={cn(
        "relative flex h-5 w-full touch-none items-center select-none data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track className="bg-track relative h-1.5 grow overflow-hidden rounded-full">
        <SliderPrimitive.Range className="bg-soft absolute h-full rounded-full" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={props["aria-label"]}
        className="bg-foreground ease-power3-out block size-4 cursor-grab rounded-full shadow-[0px_2px_6px_0px_rgba(0,0,0,0.5),0px_0px_0px_1px_rgba(0,0,0,0.4)] transition-[box-shadow] duration-150 outline-none focus-visible:shadow-[0px_2px_6px_0px_rgba(0,0,0,0.5),0px_0px_0px_4px_rgba(255,255,255,0.12)] active:cursor-grabbing"
      />
    </SliderPrimitive.Root>
  );
}

export { Slider };
