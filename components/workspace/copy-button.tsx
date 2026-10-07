"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import Button from "@/components/_ui/button";

export default function CopyButton({
  value,
  label = "Copy link",
}: {
  value: string;
  label?: string;
}) {
  const [done, setDone] = useState(false);
  return (
    <Button
      variant="secondary"
      size="icon"
      aria-label={label}
      title={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          toast.success("Invite link copied");
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          toast.error("Clipboard is not available");
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

export function inviteUrl(id: string) {
  return `${typeof window === "undefined" ? "" : window.location.origin}/invite/${id}`;
}
