"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { ChevronsUpDown, LayoutDashboard, Plus } from "lucide-react";
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
import {
  APP_NAV,
  APP_NAV_GROUPS,
  appHref,
  GLOBAL_NAV,
  isNavActive,
} from "@/lib/client/nav";
import { useApi } from "@/lib/client/api";
import { formatCompact } from "@/lib/client/format";
import type { TrackedApp } from "@/lib/client/types";
import type { AppsResult } from "@/lib/dashboard/types";
import { cn } from "@/lib/utils";
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
  const lastAppId = useUiStore((s) => s.lastAppId);
  const setLastApp = useUiStore((s) => s.setLastApp);
  const currentId = params.appId ? Number(params.appId) : null;
  const current = apps.find((a) => a.id === currentId);
  const { data: stats } = useApi<AppsResult>(current ? null : "/api/dashboard/apps");
  const downloads = new Map((stats?.apps ?? []).map((a) => [a.id, a.downloads?.current ?? null]));
  const listed = [...apps].sort((a, b) => Number(b.isMine) - Number(a.isMine) || (downloads.get(b.id) ?? -1) - (downloads.get(a.id) ?? -1) || Number(b.id === lastAppId) - Number(a.id === lastAppId));
  useEffect(() => {
    if (currentId) setLastApp(currentId);
  }, [currentId, setLastApp]);
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
              ) : apps.length ? (
                <>
                  <span className="bg-muted text-soft inline-flex size-7 shrink-0 items-center justify-center rounded-[22%]">
                    <LayoutDashboard aria-hidden className="size-3.5" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                    <span className="w-full truncate text-left text-[13px]">
                      All apps
                    </span>
                    <span className="caption-style text-subtle w-full truncate text-left">
                      {apps.length} {apps.length === 1 ? "app" : "apps"}
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
            {apps.length > 0 && (
              <>
                <DropdownMenuItem
                  onSelect={() => {
                    router.push("/");
                    close();
                  }}
                  className="gap-2"
                >
                  <span className="bg-muted text-soft inline-flex size-5 shrink-0 items-center justify-center rounded-[22%]">
                    <LayoutDashboard aria-hidden className="size-3" />
                  </span>
                  <span className="flex-1 truncate">All apps</span>
                  <span className="caption-style text-subtle">{apps.length}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
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
                <span className="flex-1 truncate">{app.name}</span>
                {!current && app.id === lastAppId && (
                  <span className="caption-style text-subtle shrink-0">last opened</span>
                )}
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
            <div className="border-sidebar-border border-b">
              {APP_NAV_GROUPS.map((group, i) => (
                <SidebarSection
                  key={group.title ?? "overview"}
                  title={group.title}
                  className={i === 0 ? "pb-0" : i === APP_NAV_GROUPS.length - 1 ? "pt-2" : "pt-2 pb-0"}
                >
                  {group.items.map((item) => (
                    <NavLink
                      key={item.slug || "overview"}
                      href={appHref(current.id, item.slug)}
                      icon={item.icon}
                      label={item.label}
                      active={isNavActive(
                        pathname,
                        appHref(current.id, item.slug),
                      )}
                      count={
                        item.slug === "keywords"
                          ? current.keywordCount
                          : undefined
                      }
                      onNavigate={close}
                    />
                  ))}
                </SidebarSection>
              ))}
            </div>
          )}
          {!current && listed.length > 0 && (
            <div className="border-sidebar-border border-b">
              <SidebarSection title="Apps · downloads 7d">
                {listed.map((app) => {
                  const n = downloads.get(app.id);
                  return (
                    <li key={app.id}>
                      <Link
                        href={appHref(app.id, "")}
                        onClick={close}
                        title={`${app.name}: ${n == null ? (app.isMine ? "no Apple downloads data yet" : "not your app, so no Apple data") : `${n.toLocaleString("en-US")} first-time downloads in the last 7 days of Apple data`}`}
                        className={cn(
                          "text-soft hover:text-foreground focus-visible:ring-ring/60 flex h-[30px] items-center gap-2 rounded-md px-2 text-[13px] outline-none hover:bg-white/4 focus-visible:ring-2",
                          app.id === lastAppId && "text-foreground",
                        )}
                      >
                        <AppIcon src={app.iconUrl} name={app.name} className="size-[18px]" />
                        <span className="min-w-0 flex-1 truncate">{app.name}</span>
                        <span className="caption-style text-subtle shrink-0 tabular-nums">
                          {n == null ? "—" : formatCompact(n)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </SidebarSection>
            </div>
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
