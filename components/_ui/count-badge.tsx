import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export default function CountBadge({
  className,
  ...props
}: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "caption-style inline-flex h-4 min-w-6 shrink-0 items-center justify-center rounded-full border-[0.5px] border-[#414141] bg-muted px-1 text-center text-chip shadow-[0px_0px_0px_0.5px_#0e0e0e]",
        className,
      )}
      {...props}
    />
  );
}
