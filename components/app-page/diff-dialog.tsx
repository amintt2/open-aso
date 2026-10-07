"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import Button from "@/components/_ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/_ui/dialog";
import { localeName } from "@/lib/asc/locales";
import type { MetadataField, MetadataPatch } from "@/lib/asc/types";

export const FIELD_LABELS: Record<MetadataField, string> = {
  name: "Name",
  subtitle: "Subtitle",
  keywords: "Keywords",
  promotionalText: "Promotional text",
  description: "Description",
  whatsNew: "What's New",
  marketingUrl: "Marketing URL",
  supportUrl: "Support URL",
  privacyPolicyUrl: "Privacy policy URL",
  privacyChoicesUrl: "Privacy choices URL",
};

export type LocaleChange = { locale: string; patch: MetadataPatch; before: Partial<Record<MetadataField, string>> };
export type SaveOutcome = { locale: string; ok: boolean; error?: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  changes: LocaleChange[];
  onConfirm: () => Promise<SaveOutcome[]>;
};

export default function DiffDialog({ open, onOpenChange, changes, onConfirm }: Props) {
  const [saving, setSaving] = useState(false);
  const [outcomes, setOutcomes] = useState<SaveOutcome[] | null>(null);
  const count = changes.reduce((n, c) => n + Object.keys(c.patch).length, 0);
  const byLocale = new Map(outcomes?.map((o) => [o.locale, o]));

  async function confirm() {
    setSaving(true);
    try {
      const result = await onConfirm();
      if (result.every((r) => r.ok)) {
        setOutcomes(null);
        onOpenChange(false);
      } else setOutcomes(result);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (saving) return;
        if (!v) setOutcomes(null);
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-[760px]">
        <DialogHeader className="pr-12">
          <DialogTitle>Review changes</DialogTitle>
          <DialogDescription>
            {count} field{count === 1 ? "" : "s"} in {changes.length} locale{changes.length === 1 ? "" : "s"} will be written to App Store Connect.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-5 px-6 py-5">
          {changes.map((c) => {
            const outcome = byLocale.get(c.locale);
            return (
              <section key={c.locale} className="flex flex-col gap-3">
                <h3 className="flex items-center gap-2 font-medium">
                  {localeName(c.locale)} <span className="caption-style text-subtle">{c.locale}</span>
                  {outcome?.ok && <CheckCircle2 aria-label="Saved" className="text-success size-3.5" />}
                  {outcome && !outcome.ok && <XCircle aria-label="Failed" className="text-danger size-3.5" />}
                </h3>
                {outcome?.error && <p className="caption-style text-danger leading-[1.4] break-words">{outcome.error}</p>}
                {(Object.keys(c.patch) as MetadataField[]).map((f) => (
                  <div key={f} className="border-border flex flex-col gap-2 rounded-lg border p-3">
                    <span className="caption-style text-subtle">{FIELD_LABELS[f]}</span>
                    <p className="text-(--tag-red-text) max-h-[140px] overflow-y-auto leading-[1.4] break-words whitespace-pre-wrap line-through decoration-white/30">
                      {c.before[f] || <span className="text-subtle no-underline">empty</span>}
                    </p>
                    <p className="text-(--tag-green-text) max-h-[140px] overflow-y-auto leading-[1.4] break-words whitespace-pre-wrap">
                      {c.patch[f] || <span className="text-subtle">empty</span>}
                    </p>
                  </div>
                ))}
              </section>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="ghost" size="md" disabled={saving} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" size="md" disabled={saving || !count} onClick={() => void confirm()}>
            {saving && <Loader2 aria-hidden className="size-3.5 animate-spin" />}
            {outcomes ? "Retry failed" : "Save to App Store Connect"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
