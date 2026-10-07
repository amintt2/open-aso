"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import Button from "@/components/_ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/_ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/_ui/select";
import { InlineError } from "@/components/asc/asc-error";
import { ASC_LOCALES, localeName } from "@/lib/asc/locales";

export function AddLocaleDialog({
  open,
  onOpenChange,
  existing,
  initial,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing: string[];
  initial?: string;
  onAdd: (locale: string) => Promise<void>;
}) {
  const taken = new Set(existing.map((l) => l.toLowerCase()));
  const options = ASC_LOCALES.filter((l) => !taken.has(l.code.toLowerCase()));
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const locale = picked ?? (initial && !taken.has(initial.toLowerCase()) ? initial : "");

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await onAdd(locale);
      setPicked(null);
      onOpenChange(false);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!busy) {
          setPicked(null);
          setError(null);
          onOpenChange(v);
        }
      }}
    >
      <DialogContent>
        <DialogHeader className="pr-12">
          <DialogTitle>Add locale</DialogTitle>
          <DialogDescription>Creates the localization on the app info and on the editable version. The name starts as a copy of the primary locale.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 px-6 py-5">
          <Select value={locale} onValueChange={setPicked}>
            <SelectTrigger aria-label="Locale">
              <SelectValue placeholder="Choose a locale" />
            </SelectTrigger>
            <SelectContent className="max-h-[320px]">
              {options.map((l) => (
                <SelectItem key={l.code} value={l.code}>
                  {l.name} <span className="text-subtle">· {l.code}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {error != null && <InlineError error={error} />}
        </div>
        <DialogFooter>
          <Button variant="ghost" size="md" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" size="md" disabled={!locale || busy} onClick={() => void submit()}>
            {busy && <Loader2 aria-hidden className="size-3.5 animate-spin" />}
            Add {locale ? localeName(locale) : "locale"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteLocaleDialog({ locale, onOpenChange, onDelete }: { locale: string | null; onOpenChange: (open: boolean) => void; onDelete: (locale: string) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function submit() {
    if (!locale) return;
    setBusy(true);
    setError(null);
    try {
      await onDelete(locale);
      onOpenChange(false);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={locale !== null}
      onOpenChange={(v) => {
        if (!busy) {
          setError(null);
          onOpenChange(v);
        }
      }}
    >
      <DialogContent>
        <DialogHeader className="pr-12">
          <DialogTitle>Delete {locale ? localeName(locale) : "locale"}?</DialogTitle>
          <DialogDescription>
            The {locale} localization is removed from App Store Connect, including its name, subtitle, keywords, description and screenshots. This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        {error != null && (
          <div className="px-6 pt-5">
            <InlineError error={error} />
          </div>
        )}
        <DialogFooter className={error != null ? "mt-5" : undefined}>
          <Button variant="ghost" size="md" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="muted" size="md" className="text-danger" disabled={busy} onClick={() => void submit()}>
            {busy && <Loader2 aria-hidden className="size-3.5 animate-spin" />}
            Delete locale
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
