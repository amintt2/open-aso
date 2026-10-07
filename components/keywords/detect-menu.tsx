"use client";

import { useState } from "react";
import { ChevronDown, Globe, Loader2, MapPin, Star, Wand2, Earth } from "lucide-react";
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

export default function DetectMenu({ country, trackedCount, running, disabled, onDetect }: Props) {
  const [confirmAll, setConfirmAll] = useState(false);
  const meta = COUNTRY_BY_CODE.get(country);
  const name = meta?.name ?? country.toUpperCase();
  const Icon = running ? Loader2 : Wand2;

  return (
    <>
      <div className="flex items-center">
        <Button
          variant="secondary"
          size="sm"
          className="h-[30px] rounded-r-none px-3"
          onClick={() => onDetect("country")}
          disabled={disabled || running}
          aria-label={`Detect my app's keywords in ${name}`}
          title={`Find the keywords this app already ranks for in ${name} (and its App Store Connect keyword field) and add them`}
        >
          <Icon aria-hidden className={running ? "size-3.5 animate-spin" : "size-3.5"} />
          <span className="hidden sm:inline">Detect</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="secondary"
              size="sm"
              className="h-[30px] rounded-l-none border-l border-black/40 px-1.5"
              disabled={disabled || running}
              aria-label="More detection options"
            >
              <ChevronDown aria-hidden className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[240px]">
            <DropdownMenuLabel>Detect keywords this app ranks for</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => onDetect("country")}>
              <MapPin aria-hidden className="size-3.5" />
              <span className="flex-1">Detect in {name}</span>
              <span aria-hidden>{meta?.flag}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onDetect("tracked")}>
              <Globe aria-hidden className="size-3.5" />
              <span className="flex-1">Detect in tracked countries</span>
              <span className="text-subtle tabular-nums">{trackedCount}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onDetect("top")}>
              <Star aria-hidden className="size-3.5" />
              <span className="flex-1">Detect in top 10 markets</span>
              <span className="text-subtle tabular-nums">10</span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setConfirmAll(true)}>
              <Earth aria-hidden className="size-3.5" />
              <span className="flex-1">Detect in all {COUNTRIES.length} countries…</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={confirmAll} onOpenChange={setConfirmAll}>
        <DialogContent className="max-w-[440px]">
          <div className="flex flex-col gap-5 p-5">
            <div className="flex flex-col gap-2 pr-8">
              <DialogTitle className="h2-style">Detect in all {COUNTRIES.length} countries?</DialogTitle>
              <DialogDescription className="text-subtle p-style">
                Every storefront is scanned one after another. App Store requests are rate-limited, so this can take a long while (often 20 minutes or more). You can keep working — progress shows at the top of this page, and new keywords count toward your plan&apos;s keyword limit.
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
                Start detection
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
