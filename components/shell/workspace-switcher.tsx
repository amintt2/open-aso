"use client";

import { reloadTo } from "@/lib/workspace/navigate";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Mail, Plus, Settings2 } from "lucide-react";
import { toast } from "sonner";
import Button from "@/components/_ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/_ui/dropdown-menu";
import CreateWorkspaceDialog from "@/components/workspace/create-workspace-dialog";
import { authClient } from "@/lib/auth-client";
import { ROLE_LABEL, type Me } from "@/lib/workspace/types";
import { WorkspaceMark } from "./user-avatar";

export default function WorkspaceSwitcher({
  me,
  onNavigate,
}: {
  me: Me | undefined;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const active = me?.workspaces.find((w) => w.id === me.activeWorkspaceId);

  async function switchTo(id: string) {
    if (id === me?.activeWorkspaceId) return;
    const res = await authClient.organization.setActive({ organizationId: id });
    if (res.error) {
      toast.error(res.error.message ?? "Could not switch workspace");
      return;
    }
    reloadTo("/");
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="none"
            className="h-11 w-full justify-start gap-2 rounded-lg px-1.5 font-normal"
            aria-label="Switch workspace"
          >
            <WorkspaceMark name={active?.name ?? "Open ASO"} />
            <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
              <span className="lead-style text-foreground w-full truncate text-left font-medium tracking-[-0.01em]">
                {active?.name ?? (me ? "No workspace" : "Loading…")}
              </span>
              <span className="caption-style text-subtle w-full truncate text-left">
                {active
                  ? `${ROLE_LABEL[active.role]} · ${active.memberCount} ${active.memberCount === 1 ? "member" : "members"}`
                  : "Open ASO"}
              </span>
            </span>
            <ChevronsUpDown
              aria-hidden
              className="text-subtle size-3.5 shrink-0"
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-(--radix-dropdown-menu-trigger-width) min-w-[230px]"
        >
          <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
          {me?.workspaces.map((w) => (
            <DropdownMenuItem
              key={w.id}
              onSelect={() => void switchTo(w.id)}
              className="gap-2"
            >
              <WorkspaceMark
                name={w.name}
                className="size-5 rounded-md text-[11px]"
              />
              <span className="min-w-0 flex-1 truncate">{w.name}</span>
              {w.id === me.activeWorkspaceId && (
                <Check aria-hidden className="text-soft size-3.5" />
              )}
            </DropdownMenuItem>
          ))}
          {!!me?.invitations.length && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Invitations</DropdownMenuLabel>
              {me.invitations.map((i) => (
                <DropdownMenuItem
                  key={i.id}
                  onSelect={() => router.push(`/invite/${i.id}`)}
                  className="gap-2"
                >
                  <Mail aria-hidden className="text-subtle size-4" />
                  <span className="min-w-0 flex-1 truncate">
                    {i.workspaceName}
                  </span>
                </DropdownMenuItem>
              ))}
            </>
          )}
          <DropdownMenuSeparator />
          {active && (
            <DropdownMenuItem
              onSelect={() => {
                router.push("/workspace");
                onNavigate?.();
              }}
              className="gap-2"
            >
              <Settings2 aria-hidden className="size-4" />
              Workspace settings
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onSelect={() => setCreating(true)}
            className="gap-2"
          >
            <Plus aria-hidden className="size-4" />
            Create workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <CreateWorkspaceDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}
