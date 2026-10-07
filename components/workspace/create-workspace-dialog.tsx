"use client";

import { reloadTo } from "@/lib/workspace/navigate";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import Button from "@/components/_ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/_ui/dialog";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import { api } from "@/lib/client/api";

export default function CreateWorkspaceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try {
      await api("/api/workspace/create", {
        method: "POST",
        body: { name: name.trim() },
      });
      reloadTo("/");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not create the workspace",
      );
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (busy) return;
        onOpenChange(o);
        if (!o) setName("");
      }}
    >
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) void create();
          }}
        >
          <div className="flex flex-col gap-4 px-6 pt-6 pr-12 pb-6">
            <DialogTitle>Create workspace</DialogTitle>
            <DialogDescription>
              Workspaces keep apps, keywords, credentials and integrations
              separate. You can invite teammates afterwards.
            </DialogDescription>
            <Field label="Name" htmlFor="workspace-name">
              <Input
                id="workspace-name"
                autoFocus
                autoComplete="off"
                maxLength={80}
                placeholder="Acme Apps"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              size="md"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={busy || !name.trim()}
            >
              {busy && (
                <Loader2 aria-hidden className="size-3.5 animate-spin" />
              )}
              Create workspace
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
