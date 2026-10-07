"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import Button from "@/components/_ui/button";
import { ScrollArea } from "@/components/_ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/_ui/sheet";
import { StatusTag, type CardState } from "./shared";

export default function IntegrationDetailSheet({
  open,
  onOpenChange,
  title,
  description,
  icon,
  state,
  stateLabel,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  icon: ReactNode;
  state: CardState;
  stateLabel?: string;
  children: ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[640px]">
        <SheetHeader className="h-auto py-4">
          <div className="flex min-w-0 items-center gap-3">
            {icon}
            <div className="flex min-w-0 flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <SheetTitle>{title}</SheetTitle>
                <StatusTag state={state} label={stateLabel} />
              </div>
              <SheetDescription className="truncate">
                {description}
              </SheetDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Close"
            onClick={() => onOpenChange(false)}
          >
            <X className="size-4" />
          </Button>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1">
          <div className="p-6">{children}</div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
