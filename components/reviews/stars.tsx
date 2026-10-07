import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span role="img" aria-label={`${value} out of 5 stars`} className={cn("inline-flex items-center gap-0.5", className)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} aria-hidden className={cn("size-3", i <= Math.round(value) ? "text-warning fill-current" : "text-faint")} />
      ))}
    </span>
  );
}
