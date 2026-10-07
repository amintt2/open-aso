"use client";

import { reloadTo } from "@/lib/workspace/navigate";
import { useState } from "react";
import { Loader2, LogOut, Trash2 } from "lucide-react";
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
import { api } from "@/lib/client/api";
import type { WorkspaceDetails } from "@/lib/workspace/types";
import SectionCard from "./section-card";

export default function DangerCard({
  workspace,
}: {
  workspace: WorkspaceDetails;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const only = workspace.workspaceCount <= 1;
  const owners = workspace.members.filter((m) => m.role === "owner").length;
  const lastOwner = workspace.role === "owner" && owners <= 1;

  async function leave() {
    if (
      !window.confirm(
        `Leave ${workspace.name}? You'll lose access until someone invites you again.`,
      )
    )
      return;
    setBusy(true);
    try {
      await api("/api/workspace/leave", { method: "POST" });
      reloadTo("/");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not leave the workspace",
      );
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api("/api/workspace", {
        method: "DELETE",
        body: { confirm: typed },
      });
      reloadTo("/");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not delete the workspace",
      );
      setBusy(false);
    }
  }

  const leaveHint = only
    ? "This is your only workspace."
    : lastOwner
      ? "Make someone else an owner before leaving."
      : null;

  return (
    <SectionCard
      id="danger"
      tone="danger"
      title="Danger zone"
      description="Leaving removes your access. Deleting removes every app, keyword, snapshot, competitor, credential and integration in this workspace for all members."
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="md"
          onClick={() => void leave()}
          disabled={busy || only || lastOwner}
        >
          <LogOut aria-hidden className="size-3.5" />
          Leave workspace
        </Button>
        {workspace.role === "owner" && (
          <Button
            variant="secondary"
            size="md"
            className="text-danger"
            onClick={() => setOpen(true)}
            disabled={busy || only}
          >
            <Trash2 aria-hidden className="size-3.5" />
            Delete workspace
          </Button>
        )}
        {(leaveHint || (only && workspace.role === "owner")) && (
          <span className="caption-style text-subtle">
            {only
              ? "This is your only workspace, so it can't be left or deleted."
              : leaveHint}
          </span>
        )}
      </div>
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
              if (typed.trim() === workspace.name.trim()) void remove();
            }}
          >
            <div className="flex flex-col gap-4 px-6 pt-6 pr-12 pb-6">
              <DialogTitle>Delete {workspace.name}?</DialogTitle>
              <DialogDescription className="text-subtle">
                This permanently deletes the workspace and all of its data for{" "}
                {workspace.members.length}{" "}
                {workspace.members.length === 1 ? "member" : "members"}. Type{" "}
                <span className="text-foreground">{workspace.name}</span> to
                confirm.
              </DialogDescription>
              <Input
                autoFocus
                autoComplete="off"
                spellCheck={false}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={workspace.name}
                aria-label="Workspace name"
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
                disabled={busy || typed.trim() !== workspace.name.trim()}
              >
                {busy && (
                  <Loader2 aria-hidden className="size-3.5 animate-spin" />
                )}
                Delete workspace
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}
