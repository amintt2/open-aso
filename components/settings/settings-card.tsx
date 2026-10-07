import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export default function SettingsCard({
  id,
  title,
  description,
  children,
  tone = "default",
  aside,
}: {
  id?: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  tone?: "default" | "danger";
  aside?: ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn(
        "bg-card flex flex-col gap-5 rounded-xl border p-5",
        tone === "danger" ? "border-(--tag-red-border)" : "border-border",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex max-w-[640px] min-w-0 flex-col gap-2">
          <h2 className={cn(tone === "danger" && "text-danger")}>{title}</h2>
          {description && <p className="text-subtle">{description}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function KeyValue({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="caption-style text-subtle">{label}</span>
      <span className="min-w-0 break-words">{value}</span>
    </div>
  );
}
