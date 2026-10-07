"use client";

import type { ComponentType, ReactElement, ReactNode } from "react";
import { ContextMenu as ContextMenuPrimitive } from "radix-ui";
import {
  Copy,
  Heart,
  HeartOff,
  PanelRightOpen,
  RefreshCw,
  Trash2,
  Trophy,
} from "lucide-react";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/_ui/dropdown-menu";
import type { TrackedKeyword } from "@/lib/client/types";
import { cn } from "@/lib/utils";
import type { RowHandlers } from "./keyword-row";

type ItemProps = {
  onSelect?: () => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
};
type MenuParts = { Item: ComponentType<ItemProps>; Separator: ComponentType };

const ITEM =
  "caption-style text-foreground ease-power3-out relative flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 transition-colors duration-150 outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-white/6";

function ContextItem({ className, ...props }: ItemProps) {
  return (
    <ContextMenuPrimitive.Item className={cn(ITEM, className)} {...props} />
  );
}

function ContextSeparator() {
  return (
    <ContextMenuPrimitive.Separator className="bg-line-strong -mx-1 my-1 h-px" />
  );
}

const CONTEXT_PARTS: MenuParts = {
  Item: ContextItem,
  Separator: ContextSeparator,
};

const DROPDOWN_PARTS: MenuParts = {
  Item: DropdownMenuItem,
  Separator: DropdownMenuSeparator,
};

function MenuItems({
  keyword: k,
  refreshing,
  handlers,
  parts: { Item, Separator },
}: {
  keyword: TrackedKeyword;
  refreshing: boolean;
  handlers: RowHandlers;
  parts: MenuParts;
}) {
  return (
    <>
      <Item onSelect={() => handlers.onOpen(k.id)}>
        <PanelRightOpen aria-hidden className="size-3.5" /> Open details
      </Item>
      <Item
        onSelect={() => handlers.onTopApps(k.id)}
        disabled={!k.topApps.length}
      >
        <Trophy aria-hidden className="size-3.5" /> Top apps
      </Item>
      <Item onSelect={() => handlers.onRefresh([k.id])} disabled={refreshing}>
        <RefreshCw aria-hidden className="size-3.5" /> Refresh
      </Item>
      <Item onSelect={() => handlers.onCopy([k.term])}>
        <Copy aria-hidden className="size-3.5" /> Copy keyword
      </Item>
      <Item onSelect={() => handlers.onLike([k.id], !k.liked)}>
        {k.liked ? (
          <HeartOff aria-hidden className="size-3.5" />
        ) : (
          <Heart aria-hidden className="size-3.5" />
        )}
        {k.liked ? "Unlike" : "Like"}
      </Item>
      <Separator />
      <Item onSelect={() => handlers.onDelete([k.id])} className="text-danger">
        <Trash2 aria-hidden className="size-3.5" /> Delete
      </Item>
    </>
  );
}

type MenuProps = {
  keyword: TrackedKeyword;
  refreshing: boolean;
  handlers: RowHandlers;
};

export function DropdownRowItems(props: MenuProps) {
  return <MenuItems {...props} parts={DROPDOWN_PARTS} />;
}

export function RowContextMenu({
  children,
  ...props
}: MenuProps & { children: ReactElement }) {
  return (
    <ContextMenuPrimitive.Root modal={false}>
      <ContextMenuPrimitive.Trigger asChild>
        {children}
      </ContextMenuPrimitive.Trigger>
      <ContextMenuPrimitive.Portal>
        <ContextMenuPrimitive.Content
          aria-label={`Actions for ${props.keyword.term}`}
          className="border-line-strong bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:ease-power3-out shadow-overlay z-50 min-w-[190px] overflow-hidden rounded-lg border p-1 duration-150"
        >
          <MenuItems {...props} parts={CONTEXT_PARTS} />
        </ContextMenuPrimitive.Content>
      </ContextMenuPrimitive.Portal>
    </ContextMenuPrimitive.Root>
  );
}
