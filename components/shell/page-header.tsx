"use client";

import type { ReactNode } from "react";
import { Menu } from "lucide-react";
import Button from "@/components/_ui/button";
import { useUiStore } from "@/stores/ui-store";

export default function PageHeader({ title, badge, actions, children }: { title: ReactNode; badge?: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);
  return (
    <header className="border-border shrink-0 border-b">
      <div className="flex min-h-[58px] flex-wrap items-center justify-between gap-2 px-4 py-[11px]">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="secondary" size="icon" className="lg:hidden" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}>
            <Menu aria-hidden className="size-3.5" />
          </Button>
          <h1 className="truncate">{title}</h1>
          {badge}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}
