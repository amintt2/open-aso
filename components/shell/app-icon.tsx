import { cn } from "@/lib/utils";

export default function AppIcon({ src, name, className }: { src?: string | null; name: string; className?: string }) {
  if (!src)
    return (
      <span className={cn("bg-muted text-soft inline-flex size-8 shrink-0 items-center justify-center rounded-[22%] text-[12px] font-medium", className)}>
        {name.slice(0, 1).toUpperCase()}
      </span>
    );
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" loading="lazy" className={cn("size-8 shrink-0 rounded-[22%] border border-white/8 object-cover", className)} />
  );
}
