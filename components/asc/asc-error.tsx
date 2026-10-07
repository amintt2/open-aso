"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import Button from "@/components/_ui/button";
import EmptyState from "@/components/shell/empty-state";
import { errorMessage } from "./use-asc";

export default function AscErrorPanel({ error, title = "App Store Connect returned an error", onRetry, className }: { error: unknown; title?: string; onRetry?: () => void; className?: string }) {
  return (
    <EmptyState
      icon={AlertTriangle}
      title={title}
      className={className}
      description={<span className="text-soft block break-words whitespace-pre-wrap">{errorMessage(error)}</span>}
      action={
        onRetry && (
          <Button variant="secondary" size="md" onClick={onRetry}>
            <RefreshCw aria-hidden className="size-3.5" />
            Try again
          </Button>
        )
      }
    />
  );
}

export function InlineError({ error }: { error: unknown }) {
  return (
    <div role="alert" className="border-(--tag-red-border) bg-(--tag-red-bg) text-(--tag-red-text) flex items-start gap-2 rounded-lg border px-3 py-2.5">
      <AlertTriangle aria-hidden className="mt-px size-3.5 shrink-0" />
      <p className="break-words">{errorMessage(error)}</p>
    </div>
  );
}
