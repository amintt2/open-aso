"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import Button from "@/components/_ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/_ui/dialog";
import { Input } from "@/components/_ui/input";
import { api, revalidate } from "@/lib/client/api";
import SettingsCard from "./settings-card";

const PHRASE = "DELETE ALL DATA";

export default function DangerZone({ canManage }: { canManage: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  async function wipe() {
    setBusy(true);
    try {
      await api("/api/integrations/wipe", {
        method: "POST",
        body: { confirm: typed },
      });
      toast.success("Workspace data deleted");
      setOpen(false);
      await revalidate("/api/");
      router.push("/");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete data");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsCard
      id="danger"
      tone="danger"
      title="Danger zone"
      description="Permanently delete every app, keyword, history snapshot, competitor, install, revenue event, integration token, credential and setting in this workspace. Members, the plan and other workspaces are kept. Export first if you might need it."
    >
      <Button
        variant="secondary"
        size="md"
        className="text-danger self-start"
        disabled={!canManage}
        onClick={() => setOpen(true)}
      >
        <Trash2 aria-hidden className="size-3.5" />
        Delete workspace data
      </Button>
      {!canManage && (
        <p className="caption-style text-subtle">
          Only workspace owners and admins can do this.
        </p>
      )}
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (busy) return;
          setOpen(o);
          setTyped("");
        }}
      >
        <DialogContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (typed === PHRASE) void wipe();
            }}
          >
            <div className="flex flex-col gap-4 px-6 pt-6 pr-12 pb-6">
              <DialogTitle>Delete this workspace&apos;s data?</DialogTitle>
              <DialogDescription className="p-style text-subtle">
                This cannot be undone. Type {PHRASE} to confirm.
              </DialogDescription>
              <Input
                autoFocus
                autoComplete="off"
                spellCheck={false}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={PHRASE}
                aria-label="Confirmation phrase"
              />
            </div>
            <DialogFooter>
              <Button
                variant="ghost"
                size="md"
                onClick={() => setOpen(false)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                className="bg-[#b42318] hover:bg-[#c8331f]"
                disabled={busy || typed !== PHRASE}
              >
                {busy && (
                  <Loader2 aria-hidden className="size-3.5 animate-spin" />
                )}
                Delete everything
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </SettingsCard>
  );
}
