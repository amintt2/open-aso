"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { useWorkerSnapshot } from "./worker-store";

export default function WorkerStatus({ onNavigate }: { onNavigate?: () => void }) {
  const { phase, today } = useWorkerSnapshot();
  const limited = phase === "limited";
  const visible = limited || phase === "working" || ((phase === "idle" || phase === "starting") && today > 0);
  if (!visible) return null;
  return (
    <Link
      href="/settings#browser-fetching"
      onClick={onNavigate}
      className="caption-style text-subtle hover:text-foreground flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors duration-150 hover:bg-white/6"
    >
      <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", limited ? "bg-(--tag-amber-text)" : "bg-trend", phase === "working" && "animate-pulse")} />
      <span className="truncate">
        {limited ? "Browser fetching paused by Apple" : "Fetching via your browser"}
        {today > 0 && ` · ${today} today`}
      </span>
    </Link>
  );
}
