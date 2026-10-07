"use client";

import { useParams, usePathname, useRouter } from "next/navigation";
import { ChevronsUpDown, Plus, Sparkles } from "lucide-react";
import Button from "@/components/_ui/button";
import { ScrollArea } from "@/components/_ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/_ui/dropdown-menu";
import SidebarSection from "@/components/_common/sidebar/sidebar-section";
import AppIcon from "./app-icon";
import NavLink from "./nav-link";
import { APP_NAV, GLOBAL_NAV } from "@/lib/client/nav";
import { useApi } from "@/lib/client/api";
import type { TrackedApp } from "@/lib/client/types";
import { useUiStore } from "@/stores/ui-store";

export default function SidebarContent() {
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams<{ appId?: string }>();
  const { data: apps = [] } = useApi<TrackedApp[]>("/api/apps");
  const setAddAppOpen = useUiStore((s) => s.setAddAppOpen);
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);
  const currentId = params.appId ? Number(params.appId) : apps[0]?.id;
  const current = apps.find((a) => a.id === currentId);
  const section = pathname.split("/")[3] ?? "keywords";
  const close = () => setSidebarOpen(false);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-sidebar-border bg-sidebar-accent flex shrink-0 items-center gap-2 border-b p-3">
        <span className="bg-primary flex size-8 shrink-0 items-center justify-center rounded-lg shadow-[inset_0px_1px_0px_rgba(255,255,255,0.2)]">
          <Sparkles aria-hidden className="size-4 text-white" strokeWidth={2} />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="lead-style block truncate font-medium tracking-[-0.01em]">Open ASO</span>
          <span className="caption-style text-subtle block truncate">App Store Optimization</span>
        </div>
      </div>

      <div className="border-sidebar-border border-b p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="none" className="h-11 w-full justify-start gap-2 rounded-lg px-2 font-normal">
              {current ? (
                <>
                  <AppIcon src={current.iconUrl} name={current.name} className="size-7" />
                  <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                    <span className="w-full truncate text-left text-[13px]">{current.name}</span>
                    <span className="caption-style text-subtle w-full truncate text-left">{current.keywordCount} keywords</span>
                  </span>
                </>
              ) : (
                <span className="text-subtle flex-1 text-left text-[13px]">No app yet</span>
              )}
              <ChevronsUpDown aria-hidden className="text-subtle size-3.5 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-(--radix-dropdown-menu-trigger-width)">
            {apps.map((app) => (
              <DropdownMenuItem
                key={app.id}
                onSelect={() => {
                  router.push(`/apps/${app.id}/${APP_NAV.some((n) => n.slug === section) ? section : "keywords"}`);
                  close();
                }}
                className="gap-2"
              >
                <AppIcon src={app.iconUrl} name={app.name} className="size-5" />
                <span className="truncate">{app.name}</span>
              </DropdownMenuItem>
            ))}
            {apps.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem onSelect={() => setAddAppOpen(true)} className="gap-2">
              <Plus aria-hidden className="size-4" />
              Add app
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <nav aria-label="Primary">
          {current && (
            <SidebarSection title="App" className="border-sidebar-border border-b">
              {APP_NAV.map((item) => (
                <NavLink
                  key={item.slug}
                  href={`/apps/${current.id}/${item.slug}`}
                  icon={item.icon}
                  label={item.label}
                  active={pathname.startsWith(`/apps/${current.id}/${item.slug}`)}
                  count={item.slug === "keywords" ? current.keywordCount : undefined}
                  onNavigate={close}
                />
              ))}
            </SidebarSection>
          )}
          <SidebarSection title="Workspace">
            {GLOBAL_NAV.map((item) => (
              <NavLink key={item.href} href={item.href} icon={item.icon} label={item.label} active={pathname.startsWith(item.href)} onNavigate={close} />
            ))}
          </SidebarSection>
        </nav>
      </ScrollArea>

      <div className="border-sidebar-border bg-sidebar-accent flex shrink-0 items-center justify-between gap-2 border-t p-4">
        <div className="flex flex-col gap-2">
          <span className="lead-style block font-medium tracking-[-0.01em]">{apps.length} apps</span>
          <span className="caption-style text-subtle block">Tracked locally</span>
        </div>
        <Button variant="muted" size="md" onClick={() => setAddAppOpen(true)}>
          <Plus aria-hidden className="size-3.5" />
          Add app
        </Button>
      </div>
    </div>
  );
}
