"use client";

import { useState } from "react";
import { Link2, Loader2, Send, X } from "lucide-react";
import { toast } from "sonner";
import Button from "@/components/_ui/button";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/_ui/select";
import { api } from "@/lib/client/api";
import {
  ROLE_LABEL,
  type WorkspaceDetails,
  type WorkspaceRole,
} from "@/lib/workspace/types";
import CopyButton, { inviteUrl } from "./copy-button";
import SectionCard from "./section-card";

function expires(iso: string) {
  const days = Math.max(
    0,
    Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000),
  );
  return days === 0
    ? "expires today"
    : `expires in ${days} ${days === 1 ? "day" : "days"}`;
}

export default function InvitesCard({
  workspace,
  onChanged,
}: {
  workspace: WorkspaceDetails;
  onChanged: () => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WorkspaceRole>("member");
  const [sending, setSending] = useState(false);
  const [created, setCreated] = useState<{ id: string; email: string } | null>(
    null,
  );
  const [cancelling, setCancelling] = useState<string | null>(null);
  const roles: WorkspaceRole[] =
    workspace.role === "owner"
      ? ["member", "admin", "owner"]
      : ["member", "admin"];

  async function invite() {
    setSending(true);
    try {
      const res = await api<{ id: string }>("/api/workspace/invitations", {
        method: "POST",
        body: { email: email.trim(), role },
      });
      setCreated({ id: res.id, email: email.trim() });
      setEmail("");
      onChanged();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not create the invitation",
      );
    } finally {
      setSending(false);
    }
  }

  async function cancel(id: string) {
    setCancelling(id);
    try {
      await api(`/api/workspace/invitations/${id}`, { method: "DELETE" });
      if (created?.id === id) setCreated(null);
      toast.success("Invitation cancelled");
      onChanged();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not cancel the invitation",
      );
    } finally {
      setCancelling(null);
    }
  }

  return (
    <SectionCard
      id="invitations"
      title="Invitations"
      description="Invite a teammate by e-mail, then send them the link. They sign in with that e-mail address to join. Links expire after 7 days."
    >
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (email.trim()) void invite();
        }}
      >
        <Field
          label="E-mail"
          htmlFor="invite-email"
          className="min-w-[220px] flex-1"
        >
          <Input
            id="invite-email"
            type="email"
            required
            autoComplete="off"
            placeholder="teammate@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Role" htmlFor="invite-role">
          <Select
            value={role}
            onValueChange={(v) => setRole(v as WorkspaceRole)}
          >
            <SelectTrigger id="invite-role" className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roles.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABEL[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Button
          type="submit"
          variant="primary"
          size="md"
          className="h-9"
          disabled={sending || !email.trim()}
        >
          {sending ? (
            <Loader2 aria-hidden className="size-3.5 animate-spin" />
          ) : (
            <Send aria-hidden className="size-3.5" />
          )}
          Create invite
        </Button>
      </form>

      {created && (
        <div
          className="border-line-strong bg-secondary flex flex-col gap-2 rounded-lg border p-3"
          role="status"
        >
          <span className="caption-style text-soft">
            Send this link to {created.email}. There is no e-mail delivery yet.
          </span>
          <div className="flex items-center gap-2">
            <code className="bg-background border-border min-w-0 flex-1 truncate rounded-md border px-2.5 py-2 font-mono text-[12px]">
              {inviteUrl(created.id)}
            </code>
            <CopyButton value={inviteUrl(created.id)} />
          </div>
        </div>
      )}

      {workspace.invitations.length > 0 ? (
        <ul className="border-border divide-border flex flex-col divide-y rounded-lg border">
          {workspace.invitations.map((i) => (
            <li
              key={i.id}
              className="flex flex-wrap items-center gap-3 px-3 py-2.5"
            >
              <Link2 aria-hidden className="text-subtle size-4 shrink-0" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate text-[14px]">{i.email}</span>
                <span className="caption-style text-subtle truncate">
                  {ROLE_LABEL[i.role]} · invited by {i.inviterName} ·{" "}
                  {expires(i.expiresAt)}
                </span>
              </div>
              <CopyButton value={inviteUrl(i.id)} />
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Cancel invitation for ${i.email}`}
                disabled={cancelling === i.id}
                onClick={() => void cancel(i.id)}
              >
                <X aria-hidden className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="caption-style text-subtle">No pending invitations.</p>
      )}
    </SectionCard>
  );
}
