import Link from "next/link";
import { ArrowRight, PlugZap, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ConnectLine({ text, action = "Open Integrations", href = "/integrations", tone = "neutral", className }: { text: string; action?: string; href?: string; tone?: "neutral" | "error"; className?: string }) {
  const Icon = tone === "error" ? TriangleAlert : PlugZap;
  return (
    <div className={cn("border-border flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed px-4 py-3", className)}>
      <span className={cn("flex min-w-0 items-center gap-2", tone === "error" ? "text-danger" : "text-soft")}>
        <Icon aria-hidden className="size-4 shrink-0" />
        <span className="min-w-0">{text}</span>
      </span>
      <Link href={href} className="caption-style text-foreground hover:text-soft inline-flex shrink-0 items-center gap-1 transition-colors duration-150">
        {action}
        <ArrowRight aria-hidden className="size-3" />
      </Link>
    </div>
  );
}
