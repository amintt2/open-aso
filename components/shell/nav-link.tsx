"use client";

import type { LucideIcon } from "lucide-react";
import Button from "@/components/_ui/button";
import CountBadge from "@/components/_ui/count-badge";
import { cn } from "@/lib/utils";

export default function NavLink({
  href,
  icon: Icon,
  label,
  active,
  count,
  onNavigate,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  count?: number;
  onNavigate?: () => void;
}) {
  return (
    <li className={cn(active && "mb-0.75")}>
      <Button
        href={href}
        variant="nav"
        size="md"
        data-active={active}
        aria-current={active ? "page" : undefined}
        onClick={onNavigate}
        className="group h-[30px] gap-2 py-0 data-[active=true]:h-8"
      >
        <Icon aria-hidden strokeWidth={1.75} className="text-subtle group-hover:text-icon group-data-[active=true]:text-icon size-3.5 shrink-0 transition-colors duration-150" />
        <span className="min-w-0 flex-1 truncate text-left">{label}</span>
        {count !== undefined && <CountBadge>{count}</CountBadge>}
      </Button>
    </li>
  );
}
