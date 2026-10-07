"use client";

import { reloadTo } from "@/lib/workspace/navigate";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronsUpDown, LogOut, Settings2, ShieldCheck } from "lucide-react";
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
import { authClient } from "@/lib/auth-client";
import type { Me } from "@/lib/workspace/types";
import UserAvatar from "./user-avatar";

export default function UserMenu({
  me,
  onNavigate,
}: {
  me: Me | undefined;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const user = me?.user;

  async function signOut() {
    setSigningOut(true);
    const res = await authClient.signOut();
    if (res.error) {
      toast.error(res.error.message ?? "Could not sign out");
      setSigningOut(false);
      return;
    }
    reloadTo("/login");
  }

  function go(href: string) {
    router.push(href);
    onNavigate?.();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="none"
          className="h-11 w-full justify-start gap-2 rounded-lg px-1.5 font-normal"
          aria-label="Account menu"
          disabled={!user || signingOut}
        >
          <UserAvatar
            name={user?.name || user?.email || "?"}
            image={user?.image}
          />
          <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
            <span className="text-foreground w-full truncate text-left text-[13px]">
              {user?.name || "Account"}
            </span>
            <span className="caption-style text-subtle w-full truncate text-left">
              {user?.email ?? " "}
            </span>
          </span>
          <ChevronsUpDown
            aria-hidden
            className="text-subtle size-3.5 shrink-0"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="top"
        align="start"
        className="w-(--radix-dropdown-menu-trigger-width) min-w-[220px]"
      >
        {user && (
          <DropdownMenuLabel className="truncate">
            {user.email}
          </DropdownMenuLabel>
        )}
        <DropdownMenuItem onSelect={() => go("/workspace")} className="gap-2">
          <Settings2 aria-hidden className="size-4" />
          Workspace settings
        </DropdownMenuItem>
        {user?.isAdmin && (
          <DropdownMenuItem onSelect={() => go("/admin")} className="gap-2">
            <ShieldCheck aria-hidden className="size-4" />
            Admin
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut()} className="gap-2">
          <LogOut aria-hidden className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
