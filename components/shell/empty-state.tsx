import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export default function EmptyState({ icon: Icon, title, description, action, className }: { icon: LucideIcon; title: string; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center", className)}>
      <span className="bg-secondary flex size-11 items-center justify-center rounded-xl shadow-[0px_0px_0px_1px_rgba(0,0,0,0.4),inset_0px_1px_0px_0px_rgba(255,255,255,0.1)]">
        <Icon aria-hidden className="text-soft size-5" strokeWidth={1.75} />
      </span>
      <div className="flex max-w-[420px] flex-col gap-2">
        <h2>{title}</h2>
        {description && <p className="text-subtle">{description}</p>}
      </div>
      {action}
    </div>
  );
}
