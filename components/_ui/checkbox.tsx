"use client";

import type { ComponentProps } from "react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";
import SquareIcon from "@/public/assets/images/companies/table/square.svg";
import CheckSquareIcon from "@/public/assets/images/companies/table/check-square.svg";
import MinusSquareIcon from "@/public/assets/images/companies/table/minus-square.svg";

function Checkbox({
  className,
  ...props
}: ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "group peer inline-flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-[4px] text-[#323232] outline-none select-none transition-[color] duration-150 ease-power3-out hover:text-line-strong focus-visible:ring-2 focus-visible:ring-ring/60 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SquareIcon
        aria-hidden
        className="size-4 group-data-[state=checked]:hidden group-data-[state=indeterminate]:hidden"
      />
      <CheckSquareIcon
        aria-hidden
        className="hidden size-4 group-data-[state=checked]:block"
      />
      <MinusSquareIcon
        aria-hidden
        className="hidden size-4 group-data-[state=indeterminate]:block"
      />
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
