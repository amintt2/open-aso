"use client";

import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/_ui/sheet";
import SidebarResizer from "@/components/_common/sidebar/sidebar-resizer";
import SidebarContent from "./sidebar-content";
import { useUiStore } from "@/stores/ui-store";

export default function Sidebar() {
  const open = useUiStore((s) => s.sidebarOpen);
  const setOpen = useUiStore((s) => s.setSidebarOpen);
  return (
    <>
      <aside className="border-sidebar-border bg-sidebar relative hidden w-(--sidebar-width) shrink-0 border-r lg:flex lg:flex-col">
        <SidebarContent />
        <SidebarResizer />
      </aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="border-sidebar-border bg-sidebar w-[254px] max-w-[85vw]">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">Apps and workspace sections</SheetDescription>
          <SidebarContent />
        </SheetContent>
      </Sheet>
    </>
  );
}
