"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import Button from "@/components/_ui/button";
import { cn } from "@/lib/utils";

export default function ExpandableText({ text, lines = 6, className }: { text: string; lines?: number; className?: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const long = text.length > 420 || text.split("\n").length > lines;
  return (
    <div className={cn("flex flex-col items-start gap-2", className)}>
      <p
        id={id}
        className="text-soft leading-[1.5] break-words whitespace-pre-line"
        style={!open && long ? { display: "-webkit-box", WebkitLineClamp: lines, WebkitBoxOrient: "vertical", overflow: "hidden" } : undefined}
      >
        {text}
      </p>
      {long && (
        <Button variant="ghost" size="sm" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)} className="-ml-2">
          {open ? "Show less" : "Show more"}
          <ChevronDown aria-hidden className={cn("size-3.5 transition-transform duration-150", open && "rotate-180")} />
        </Button>
      )}
    </div>
  );
}
