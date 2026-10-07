"use client";

import { useRef, useState } from "react";
import { Download, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import Button, { buttonVariants } from "@/components/_ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/_ui/dialog";
import { api, revalidate } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import SettingsCard from "./settings-card";

export default function DataSettings({
  canManage,
  onChanged,
}: {
  canManage: boolean;
  onChanged: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{
    name: string;
    payload: unknown;
    tables: number;
    rows: number;
  } | null>(null);
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [busy, setBusy] = useState(false);

  async function pick(file: File) {
    try {
      const payload = JSON.parse(await file.text()) as {
        format?: string;
        tables?: Record<string, unknown[]>;
      };
      if (payload.format !== "open-aso-export" || !payload.tables)
        throw new Error("This file is not an Open ASO export");
      const tables = Object.values(payload.tables);
      setPending({
        name: file.name,
        payload,
        tables: tables.length,
        rows: tables.reduce((a, t) => a + (Array.isArray(t) ? t.length : 0), 0),
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read the file");
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  async function runImport() {
    if (!pending) return;
    setBusy(true);
    try {
      const res = await api<{
        imported: Record<string, number>;
        skipped: number;
      }>(`/api/integrations/import?mode=${mode}`, {
        method: "POST",
        body: pending.payload,
      });
      const total = Object.values(res.imported).reduce((a, b) => a + b, 0);
      toast.success(
        `Imported ${total.toLocaleString()} rows${res.skipped ? ` · ${res.skipped.toLocaleString()} skipped` : ""}`,
      );
      setPending(null);
      onChanged();
      await revalidate("/api/");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsCard
      id="data"
      title="Data"
      description="Export this workspace as JSON, or import an export into it. Other workspaces are never touched."
    >
      <div className="flex flex-wrap gap-2">
        {canManage ? (
          <a
            href="/api/integrations/export"
            download
            className={buttonVariants({ variant: "secondary", size: "md" })}
          >
            <Download aria-hidden className="size-3.5" />
            Export JSON
          </a>
        ) : (
          <Button variant="secondary" size="md" disabled>
            <Download aria-hidden className="size-3.5" />
            Export JSON
          </Button>
        )}
        <Button
          variant="secondary"
          size="md"
          disabled={!canManage}
          onClick={() => input.current?.click()}
        >
          <Upload aria-hidden className="size-3.5" />
          Import JSON
        </Button>
        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])}
        />
      </div>
      <p className="caption-style text-subtle">
        Exports contain this workspace&apos;s apps, keywords, history,
        competitors, installs, revenue and non-secret settings. API keys, tokens
        and signing secrets are never exported. Imports get new ids, so an
        export can be loaded into any workspace, including exports from a
        self-hosted Open ASO.
        {!canManage &&
          " Only workspace owners and admins can export or import."}
      </p>
      <Dialog
        open={!!pending}
        onOpenChange={(o) => !o && !busy && setPending(null)}
      >
        <DialogContent>
          <div className="flex flex-col gap-2 px-6 pt-6 pr-12 pb-4">
            <DialogTitle>Import {pending?.name}</DialogTitle>
            <DialogDescription className="p-style text-subtle">
              {pending?.rows.toLocaleString()} rows across {pending?.tables}{" "}
              tables.
            </DialogDescription>
          </div>
          <div
            role="radiogroup"
            aria-label="Import mode"
            className="flex flex-col gap-2 px-6 pb-6"
          >
            {(
              [
                {
                  value: "merge",
                  title: "Merge",
                  text: "Add rows and update matching apps, keywords and settings. Nothing is deleted.",
                },
                {
                  value: "replace",
                  title: "Replace",
                  text: "Delete this workspace's data first (credentials are kept), then import.",
                },
              ] as const
            ).map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={mode === o.value}
                onClick={() => setMode(o.value)}
                className={cn(
                  "flex cursor-pointer flex-col gap-1.5 rounded-lg border p-3 text-left transition-colors duration-150",
                  mode === o.value
                    ? "border-ring bg-white/4"
                    : "border-line-strong hover:bg-white/2",
                )}
              >
                <span className="lead-style">{o.title}</span>
                <span className="caption-style text-subtle">{o.text}</span>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              size="md"
              onClick={() => setPending(null)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={runImport}
              disabled={busy}
            >
              {busy && (
                <Loader2 aria-hidden className="size-3.5 animate-spin" />
              )}
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SettingsCard>
  );
}
