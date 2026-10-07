"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/_ui/dialog";
import Button from "@/components/_ui/button";
import { api, revalidate } from "@/lib/client/api";
import type { ChangeResult } from "@/lib/apple-ads/types";
import { useAdsUi } from "./store";

export type ChangeSpec = {
  title: string;
  description?: string;
  url: string;
  method: "POST" | "PATCH";
  body: Record<string, unknown>;
  success?: string;
  onDone?: () => void;
};

type Pending = { spec: ChangeSpec; preview: ChangeResult; result: ChangeResult | null };

const ChangeContext = createContext<(spec: ChangeSpec) => Promise<void>>(async () => {});

export function useRequestChange() {
  return useContext(ChangeContext);
}

export default function ChangeProvider({ children }: { children: ReactNode }) {
  const demo = useAdsUi((s) => s.demo);
  const [pending, setPending] = useState<Pending | null>(null);
  const [applying, setApplying] = useState(false);

  const request = useCallback(
    async (spec: ChangeSpec) => {
      try {
        const preview = await api<ChangeResult>(spec.url, { method: spec.method, body: { ...spec.body, dryRun: true, demo } });
        if (!preview.changes.length) {
          toast.info(preview.warnings[0] ?? "Nothing to change");
          return;
        }
        setPending({ spec, preview, result: null });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not prepare the change");
      }
    },
    [demo],
  );

  async function apply() {
    if (!pending) return;
    if (pending.preview.demo) {
      toast.info("Demo preview: nothing was sent to Apple Ads. Connect an account to apply changes.");
      setPending(null);
      return;
    }
    setApplying(true);
    try {
      const result = await api<ChangeResult>(pending.spec.url, { method: pending.spec.method, body: { ...pending.spec.body, dryRun: false } });
      await revalidate("/api/apple-ads/");
      const failed = result.results.filter((r) => !r.ok);
      if (failed.length) {
        setPending({ ...pending, result });
        toast.error(`${failed.length} of ${result.results.length} step(s) failed`);
      } else {
        toast.success(pending.spec.success ?? "Changes applied");
        pending.spec.onDone?.();
        setPending(null);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Apple Ads rejected the change");
    } finally {
      setApplying(false);
    }
  }

  const value = useMemo(() => request, [request]);
  const changes = pending?.preview.changes ?? [];
  const result = pending?.result;

  return (
    <ChangeContext.Provider value={value}>
      {children}
      <Dialog open={pending !== null} onOpenChange={(open) => !open && !applying && setPending(null)}>
        <DialogContent className="max-w-[640px]">
          <DialogHeader className="pr-12">
            <DialogTitle>{pending?.spec.title ?? "Review changes"}</DialogTitle>
            <DialogDescription>
              {pending?.preview.demo ? "Demo preview. Review what would be sent to Apple Ads." : (pending?.spec.description ?? "Review exactly what will be sent to Apple Ads before applying.")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 px-6 py-5">
            <ul className="border-border divide-border flex flex-col divide-y rounded-lg border">
              {changes.map((c, i) => (
                <li key={i} className="flex flex-col gap-2 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-[13px]">{c.entity}</span>
                    <span className="caption-style text-subtle shrink-0">{c.field}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[13px] tabular-nums">
                    {c.before != null && (
                      <>
                        <span className="text-subtle line-through">{c.before}</span>
                        <ArrowRight aria-hidden className="text-subtle size-3" />
                      </>
                    )}
                    <span className="text-foreground break-all">{c.after}</span>
                    {c.warning && <span className="caption-style text-warning">{c.warning}</span>}
                  </div>
                </li>
              ))}
            </ul>
            {pending && pending.preview.warnings.length > 0 && (
              <div className="border-(--tag-amber-border) bg-(--tag-amber-bg) flex flex-col gap-2 rounded-lg border p-3">
                {pending.preview.warnings.map((w, i) => (
                  <p key={i} className="text-(--tag-amber-text) flex gap-2 text-[13px]">
                    <AlertTriangle aria-hidden className="mt-px size-3.5 shrink-0" />
                    {w}
                  </p>
                ))}
              </div>
            )}
            {result && (
              <ul className="flex flex-col gap-2">
                {result.results.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px]">
                    {r.ok ? <CheckCircle2 aria-hidden className="text-success mt-px size-3.5 shrink-0" /> : <XCircle aria-hidden className="text-danger mt-px size-3.5 shrink-0" />}
                    <span className="flex flex-col gap-1">
                      <span>{r.entity}</span>
                      {r.error && <span className="text-danger caption-style">{r.error}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" size="md" disabled={applying} onClick={() => setPending(null)}>
              {result ? "Close" : "Cancel"}
            </Button>
            {!result && (
              <Button variant="primary" size="md" disabled={applying} onClick={apply}>
                {applying && <Loader2 aria-hidden className="size-3.5 animate-spin" />}
                {pending?.preview.demo ? "Simulate" : `Apply ${changes.length} change${changes.length === 1 ? "" : "s"}`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ChangeContext.Provider>
  );
}
