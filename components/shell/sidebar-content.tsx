"use client";

import { useParams, usePathname, useRouter } from "next/navigation";
import { ChevronsUpDown, Plus } from "lucide-react";
import Button from "@/components/_ui/button";
import { ScrollArea } from "@/components/_ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/_ui/dropdown-menu";
import SidebarSection from "@/components/_common/sidebar/sidebar-section";
import AppIcon from "./app-icon";
import NavLink from "./nav-link";
import UserMenu from "./user-menu";
import WorkspaceSwitcher from "./workspace-switcher";
import WorkerStatus from "@/components/worker/worker-status";
import { APP_NAV, appHref, GLOBAL_NAV, isNavActive } from "@/lib/client/nav";
import { useApi } from "@/lib/client/api";
import type { TrackedApp } from "@/lib/client/types";
import type { Me } from "@/lib/workspace/types";
import { useUiStore } from "@/stores/ui-store";

export default function SidebarContent() {
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams<{ appId?: string }>();
  const { data: me } = useApi<Me>("/api/workspace/me");
  const { data: apps = [] } = useApi<TrackedApp[]>("/api/apps");
  const setAddAppOpen = useUiStore((s) => s.setAddAppOpen);
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);
  const currentId = params.appId ? Number(params.appId) : apps[0]?.id;
  const current = apps.find((a) => a.id === currentId);
  const section = pathname.startsWith("/apps/")
    ? (pathname.split("/")[3] ?? "")
    : null;
  const close = () => setSidebarOpen(false);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-sidebar-border bg-sidebar-accent shrink-0 border-b p-2">
        <WorkspaceSwitcher me={me} onNavigate={close} />
      </div>

      <div className="border-sidebar-border border-b p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="secondary"
              size="none"
              className="h-11 w-full justify-start gap-2 rounded-lg px-2 font-normal"
            >
              {current ? (
                <>
                  <AppIcon
                    src={current.iconUrl}
                    name={current.name}
                    className="size-7"
                  />
                  <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                    <span className="w-full truncate text-left text-[13px]">
                      {current.name}
                    </span>
                    <span className="caption-style text-subtle w-full truncate text-left">
                      {current.keywordCount} keywords
                    </span>
                  </span>
                </>
              ) : (
                <span className="text-subtle flex-1 text-left text-[13px]">
                  No app yet
                </span>
              )}
              <ChevronsUpDown
                aria-hidden
                className="text-subtle size-3.5 shrink-0"
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-(--radix-dropdown-menu-trigger-width)"
          >
            {apps.map((app) => (
              <DropdownMenuItem
                key={app.id}
                onSelect={() => {
                  router.push(
                    appHref(
                      app.id,
                      APP_NAV.find((n) => n.slug === section)?.slug ?? "",
                    ),
                  );
                  close();
                }}
                className="gap-2"
              >
                <AppIcon src={app.iconUrl} name={app.name} className="size-5" />
                <span className="truncate">{app.name}</span>
              </DropdownMenuItem>
            ))}
            {apps.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem
              onSelect={() => setAddAppOpen(true)}
              className="gap-2"
            >
              <Plus aria-hidden className="size-4" />
              Add app
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <nav aria-label="Primary">
          {current && (
            <SidebarSection
              title="App"
              className="border-sidebar-border border-b"
            >
              {APP_NAV.map((item) => (
                <NavLink
                  key={item.slug || "overview"}
                  href={appHref(current.id, item.slug)}
                  icon={item.icon}
                  label={item.label}
                  active={isNavActive(pathname, appHref(current.id, item.slug))}
                  count={
                    item.slug === "keywords" ? current.keywordCount : undefined
                  }
                  onNavigate={close}
                />
              ))}
            </SidebarSection>
          )}
          <SidebarSection title="Workspace">
            {GLOBAL_NAV.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={item.label}
                active={isNavActive(pathname, item.href)}
                onNavigate={close}
              />
            ))}
          </SidebarSection>
        </nav>
      </ScrollArea>

      <div className="border-sidebar-border bg-sidebar-accent shrink-0 border-t p-2">
        <WorkerStatus onNavigate={close} />
        <UserMenu me={me} onNavigate={close} />
      </div>
    </div>
  );
}
