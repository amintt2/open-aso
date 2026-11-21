"use client";

import { useState } from "react";
import { ChevronDown, Earth, Globe, Loader2, MapPin, Star, Wand2 } from "lucide-react";
import Button from "@/components/_ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/_ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/_ui/dropdown-menu";
import { COUNTRIES, COUNTRY_BY_CODE } from "@/lib/appstore/countries";
import type { DetectScope } from "./use-keyword-detect";

type Props = {
  country: string;
  trackedCount: number;
  running: boolean;
  disabled: boolean;
  onDetect: (scope: DetectScope) => void;
};

export default function FindMenu({ country, trackedCount, running, disabled, onDetect }: Props) {
  const [confirmAll, setConfirmAll] = useState(false);
  const meta = COUNTRY_BY_CODE.get(country);
  const name = meta?.name ?? country.toUpperCase();
  const Icon = running ? Loader2 : Wand2;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="secondary"
            size="sm"
            className="h-[30px] px-3"
            disabled={disabled || running}
            aria-label="Find keywords"
            title="Scan your metadata and the App Store for keywords this app is indexed or ranked for, and add the new ones"
          >
            <Icon aria-hidden className={running ? "size-3.5 animate-spin" : "size-3.5"} />
            <span className="hidden sm:inline">{running ? "Finding…" : "Find keywords"}</span>
            <ChevronDown aria-hidden className="text-subtle size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[260px]">
          <DropdownMenuLabel>Scan metadata and rankings in</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => onDetect("country")}>
            <MapPin aria-hidden className="size-3.5" />
            <span className="flex-1">{name}</span>
            <span aria-hidden>{meta?.flag}</span>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onDetect("tracked")}>
            <Globe aria-hidden className="size-3.5" />
            <span className="flex-1">Countries you track</span>
            <span className="text-subtle tabular-nums">{trackedCount}</span>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onDetect("top")}>
            <Star aria-hidden className="size-3.5" />
            <span className="flex-1">Top 10 markets</span>
            <span className="text-subtle tabular-nums">10</span>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setConfirmAll(true)}>
            <Earth aria-hidden className="size-3.5" />
            <span className="flex-1">All {COUNTRIES.length} countries…</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmAll} onOpenChange={setConfirmAll}>
        <DialogContent className="max-w-[440px]">
          <div className="flex flex-col gap-5 p-5">
            <div className="flex flex-col gap-2 pr-8">
              <DialogTitle className="h2-style">Find keywords in all {COUNTRIES.length} countries?</DialogTitle>
              <DialogDescription className="text-subtle p-style">
                Every storefront is scanned one after another. App Store requests are rate-limited, so this often takes 20 minutes or more. You can keep working: progress shows at the top of this page. New keywords count toward your plan&apos;s keyword limit, and you can remove the noise afterwards with Clean up.
              </DialogDescription>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="md" onClick={() => setConfirmAll(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                autoFocus
                onClick={() => {
                  setConfirmAll(false);
                  onDetect("all");
                }}
              >
                <Earth aria-hidden className="size-3.5" />
                Start scan
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
