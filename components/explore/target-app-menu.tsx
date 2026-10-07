"use client";

import type { ReactNode } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/_ui/dropdown-menu";
import AppIcon from "@/components/shell/app-icon";
import { useApi } from "@/lib/client/api";
import type { TrackedApp } from "@/lib/client/types";

type Props = {
  label: string;
  children: ReactNode;
  onSelect: (app: TrackedApp) => void;
  exclude?: number[];
  align?: "start" | "end";
  footer?: ReactNode;
};

export default function TargetAppMenu({ label, children, onSelect, exclude = [], align = "end", footer }: Props) {
  const { data: apps = [], isLoading } = useApi<TrackedApp[]>("/api/apps");
  const list = apps.filter((a) => !exclude.includes(a.trackId));
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-[260px]">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        {list.map((app) => (
          <DropdownMenuItem key={app.id} onSelect={() => onSelect(app)} className="gap-2">
            <AppIcon src={app.iconUrl} name={app.name} className="size-5" />
            <span className="min-w-0 flex-1 truncate">{app.name}</span>
            {app.isMine && <span className="text-subtle">Mine</span>}
          </DropdownMenuItem>
        ))}
        {!list.length && (
          <DropdownMenuItem disabled className="text-subtle">
            {isLoading ? "Loading apps…" : "No tracked apps yet"}
          </DropdownMenuItem>
        )}
        {footer && (
          <>
            <DropdownMenuSeparator />
            {footer}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
