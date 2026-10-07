"use client";

import { useState } from "react";
import { UserMinus } from "lucide-react";
import { toast } from "sonner";
import Button from "@/components/_ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/_ui/select";
import Tag from "@/components/_ui/tag";
import UserAvatar from "@/components/shell/user-avatar";
import { api } from "@/lib/client/api";
import {
  ROLE_LABEL,
  type WorkspaceDetails,
  type WorkspaceMember,
  type WorkspaceRole,
} from "@/lib/workspace/types";
import SectionCard from "./section-card";

function canManage(
  viewer: WorkspaceRole,
  member: WorkspaceMember,
  isSelf: boolean,
) {
  if (isSelf || viewer === "member") return false;
  return viewer === "owner" || member.role !== "owner";
}

export default function MembersCard({
  workspace,
  onChanged,
}: {
  workspace: WorkspaceDetails;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const roles: WorkspaceRole[] =
    workspace.role === "owner"
      ? ["owner", "admin", "member"]
      : ["admin", "member"];

  async function run(id: string, fn: () => Promise<unknown>, message: string) {
    setBusy(id);
    try {
      await fn();
      toast.success(message);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  return (
    <SectionCard
      id="members"
      title="Members"
      description="Owners manage billing and can delete the workspace. Admins manage members, invitations, credentials and integrations. Members can use everything else."
    >
      <ul className="border-border divide-border flex flex-col divide-y rounded-lg border">
        {workspace.members.map((m) => {
          const self = m.userId === workspace.userId;
          const manage = canManage(workspace.role, m, self);
          return (
            <li
              key={m.id}
              className="flex flex-wrap items-center gap-3 px-3 py-2.5"
            >
              <UserAvatar
                name={m.name || m.email}
                image={m.image}
                className="size-8"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate text-[14px]">
                  {m.name || m.email}
                  {self && <span className="text-subtle"> (you)</span>}
                </span>
                <span className="caption-style text-subtle truncate">
                  {m.email}
                </span>
              </div>
              {manage ? (
                <div className="flex items-center gap-1">
                  <Select
                    value={m.role}
                    disabled={busy === m.id}
                    onValueChange={(role) =>
                      run(
                        m.id,
                        () =>
                          api(`/api/workspace/members/${m.id}`, {
                            method: "PATCH",
                            body: { role },
                          }),
                        "Role updated",
                      )
                    }
                  >
                    <SelectTrigger
                      className="h-8 w-[118px]"
                      aria-label={`Role for ${m.email}`}
                    >
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
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${m.email}`}
                    disabled={busy === m.id}
                    onClick={() =>
                      window.confirm(
                        `Remove ${m.name || m.email} from ${workspace.name}?`,
                      ) &&
                      run(
                        m.id,
                        () =>
                          api(`/api/workspace/members/${m.id}`, {
                            method: "DELETE",
                          }),
                        "Member removed",
                      )
                    }
                  >
                    <UserMinus aria-hidden className="size-3.5" />
                  </Button>
                </div>
              ) : (
                <Tag
                  tone={
                    m.role === "owner"
                      ? "purple"
                      : m.role === "admin"
                        ? "blue"
                        : "neutral"
                  }
                  size="md"
                >
                  {ROLE_LABEL[m.role]}
                </Tag>
              )}
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}
