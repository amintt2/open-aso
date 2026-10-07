"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import Button from "@/components/_ui/button";
import { Input } from "@/components/_ui/input";
import { api, revalidate } from "@/lib/client/api";
import type { TrackedApp } from "@/lib/client/types";

export default function SubtitleField({ app, onSaved }: { app: TrackedApp; onSaved: () => void }) {
  const [value, setValue] = useState(app.subtitle ?? "");
  const [saving, setSaving] = useState(false);
  const [synced, setSynced] = useState(app.subtitle);
  if (synced !== app.subtitle) {
    setSynced(app.subtitle);
    setValue(app.subtitle ?? "");
  }
  const dirty = value.trim() !== (app.subtitle ?? "");

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!dirty) return;
    setSaving(true);
    try {
      await api<TrackedApp>(`/api/apps/${app.id}`, { method: "PATCH", body: { subtitle: value.trim() || null } });
      await revalidate(`/api/apps/${app.id}`);
      onSaved();
      toast.success("Subtitle saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save subtitle");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="flex gap-2">
      <Input id="subtitle-input" value={value} maxLength={30} onChange={(e) => setValue(e.target.value)} placeholder="Type your live subtitle" className="flex-1" />
      <Button type="submit" variant="muted" size="md" disabled={!dirty || saving} className="h-9 px-3">
        {saving ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : "Save"}
      </Button>
    </form>
  );
}
