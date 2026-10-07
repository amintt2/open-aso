"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import Button from "@/components/_ui/button";
import { cn } from "@/lib/utils";

export async function copyText(value: string, label = "Copied") {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(label);
    return true;
  } catch {
    toast.error("Clipboard is not available");
    return false;
  }
}

export function CopyButton({
  value,
  label,
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [done, setDone] = useState(false);
  return (
    <Button
      variant="secondary"
      size="icon"
      className={cn("shrink-0", className)}
      aria-label={label ?? "Copy"}
      onClick={async () => {
        if (await copyText(value, label ? `${label} copied` : "Copied")) {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        }
      }}
    >
      {done ? (
        <Check aria-hidden className="text-trend size-3.5" />
      ) : (
        <Copy aria-hidden className="size-3.5" />
      )}
    </Button>
  );
}

export default function CopyField({
  label,
  value,
  mono = true,
  secret = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  secret?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="caption-style text-soft">{label}</span>
      <div className="flex items-center gap-2">
        <code
          className={cn(
            "border-line-strong bg-secondary flex h-9 min-w-0 flex-1 items-center overflow-x-auto rounded-lg border px-3 text-[13px] whitespace-nowrap",
            mono && "font-mono",
            secret && "text-(--tag-amber-text)",
          )}
        >
          {value}
        </code>
        <CopyButton value={value} label={label} />
      </div>
    </div>
  );
}

export function CodeBlock({
  code,
  title,
  language,
}: {
  code: string;
  title: string;
  language: string;
}) {
  return (
    <div className="border-line-strong overflow-hidden rounded-lg border">
      <div className="bg-secondary border-line-strong flex items-center justify-between gap-2 border-b py-1.5 pr-1.5 pl-3">
        <span className="caption-style text-soft truncate font-mono">
          {title}
        </span>
        <span className="flex items-center gap-2">
          <span className="caption-style text-subtle">{language}</span>
          <CopyButton value={code} label={title} className="size-6" />
        </span>
      </div>
      <pre className="max-h-[360px] overflow-auto bg-[#121212] p-3 font-mono text-[12px] leading-[1.55] text-[#d4d4d4]">
        <code>{code}</code>
      </pre>
    </div>
  );
}
