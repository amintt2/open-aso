"use client";

import { useRef, useState } from "react";
import { Download, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import Button, { buttonVariants } from "@/components/_ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/_ui/dialog";
import { api, revalidate } from "@/lib/client/api";
import { CopyButton } from "@/components/integrations/copy-field";
import { cn } from "@/lib/utils";
import SettingsCard, { KeyValue } from "./settings-card";
import type { SystemInfo } from "./system-settings";

function bytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function DataSettings({ info, onChanged }: { info: SystemInfo | undefined; onChanged: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ name: string; payload: unknown; tables: number; rows: number } | null>(null);
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [busy, setBusy] = useState(false);
  const db = info?.database;
  const rows = db?.tables.reduce((a, t) => a + t.rows, 0) ?? 0;

  async function pick(file: File) {
    try {
      const payload = JSON.parse(await file.text()) as { format?: string; tables?: Record<string, unknown[]> };
      if (payload.format !== "open-aso-export" || !payload.tables) throw new Error("This file is not an Open ASO export");
      const tables = Object.values(payload.tables);
      setPending({ name: file.name, payload, tables: tables.length, rows: tables.reduce((a, t) => a + (Array.isArray(t) ? t.length : 0), 0) });
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
      const res = await api<{ imported: Record<string, number> }>(`/api/integrations/import?mode=${mode}`, { method: "POST", body: pending.payload });
      const total = Object.values(res.imported).reduce((a, b) => a + b, 0);
      toast.success(`Imported ${total.toLocaleString()} rows`);
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
    <SettingsCard id="data" title="Data" description="Everything Open ASO knows lives in one SQLite file on this machine. Back it up by copying the folder, or export it as JSON.">
      <div className="grid gap-5 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <KeyValue
          label="Database location"
          value={
            db ? (
              <span className="flex items-center gap-2">
                <code className="truncate font-mono text-[13px]" title={db.file}>
                  {db.file}
                </code>
                <CopyButton value={db.file} label="Path" className="size-6" />
              </span>
            ) : (
              "—"
            )
          }
        />
        <KeyValue label="Size on disk" value={db ? bytes(db.sizeBytes) : "—"} />
        <KeyValue label="Rows" value={db ? rows.toLocaleString() : "—"} />
      </div>
      <p className="caption-style text-subtle">Change the location with the OPEN_ASO_DATA_DIR environment variable.</p>
      {db && (
        <details className="group">
          <summary className="caption-style text-soft hover:text-foreground cursor-pointer select-none">Show tables ({db.tables.length})</summary>
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
            {db.tables.map((t) => (
              <div key={t.name} className="caption-style flex justify-between gap-2">
                <span className="text-soft truncate font-mono">{t.name}</span>
                <span className="text-subtle tabular-nums">{t.rows.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </details>
      )}
      <div className="flex flex-wrap gap-2">
        <a href="/api/integrations/export" download className={buttonVariants({ variant: "secondary", size: "md" })}>
          <Download aria-hidden className="size-3.5" />
          Export JSON
        </a>
        <Button variant="secondary" size="md" onClick={() => input.current?.click()}>
          <Upload aria-hidden className="size-3.5" />
          Import JSON
        </Button>
        <input ref={input} type="file" accept="application/json,.json" className="hidden" onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])} />
      </div>
      <p className="caption-style text-subtle">Exports contain apps, keywords, history, competitors, installs, revenue and non-secret settings. API keys, tokens and signing secrets are never exported.</p>
      <Dialog open={!!pending} onOpenChange={(o) => !o && !busy && setPending(null)}>
        <DialogContent>
          <div className="flex flex-col gap-2 px-6 pt-6 pr-12 pb-4">
            <DialogTitle>Import {pending?.name}</DialogTitle>
            <DialogDescription className="p-style text-subtle">
              {pending?.rows.toLocaleString()} rows across {pending?.tables} tables.
            </DialogDescription>
          </div>
          <div role="radiogroup" aria-label="Import mode" className="flex flex-col gap-2 px-6 pb-6">
            {(
              [
                { value: "merge", title: "Merge", text: "Add rows and overwrite rows with the same id. Nothing is deleted." },
                { value: "replace", title: "Replace", text: "Delete current data first (credentials are kept), then import." },
              ] as const
            ).map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={mode === o.value}
                onClick={() => setMode(o.value)}
                className={cn("flex cursor-pointer flex-col gap-1.5 rounded-lg border p-3 text-left transition-colors duration-150", mode === o.value ? "border-ring bg-white/4" : "border-line-strong hover:bg-white/2")}
              >
                <span className="lead-style">{o.title}</span>
                <span className="caption-style text-subtle">{o.text}</span>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" size="md" onClick={() => setPending(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" size="md" onClick={runImport} disabled={busy}>
              {busy && <Loader2 aria-hidden className="size-3.5 animate-spin" />}
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SettingsCard>
  );
}
