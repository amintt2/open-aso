"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Button from "@/components/_ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/_ui/dialog";

type Shot = { url: string; device: "iPhone" | "iPad"; index: number };

function large(url: string) {
  return url.replace(/\/\d+x\d+(bb)?\.(png|jpg|jpeg|webp)$/, "/1200x0w.$2");
}

function Strip({ title, shots, onOpen }: { title: string; shots: Shot[]; onOpen: (shot: Shot) => void }) {
  if (!shots.length) return null;
  return (
    <section className="flex flex-col gap-3" aria-label={`${title} screenshots`}>
      <h3 className="caption-style text-subtle">{title}</h3>
      <ul className="flex gap-3 overflow-x-auto pb-2">
        {shots.map((shot) => (
          <li key={shot.url} className="shrink-0">
            <button
              type="button"
              onClick={() => onOpen(shot)}
              className="border-border block cursor-zoom-in overflow-hidden rounded-lg border outline-none transition-opacity duration-150 hover:opacity-85 focus-visible:ring-2 focus-visible:ring-ring/60"
              aria-label={`Enlarge ${shot.device} screenshot ${shot.index + 1}`}
            >
              <Image
                src={shot.url}
                alt=""
                width={shot.device === "iPhone" ? 392 : 480}
                height={shot.device === "iPhone" ? 696 : 360}
                unoptimized
                loading="lazy"
                className={shot.device === "iPhone" ? "h-[320px] w-auto max-w-none" : "h-[240px] w-auto max-w-none"}
              />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function Screenshots({ iphone, ipad }: { iphone: string[]; ipad: string[] }) {
  const shots: Shot[] = [
    ...iphone.map((url, index) => ({ url, device: "iPhone" as const, index })),
    ...ipad.map((url, index) => ({ url, device: "iPad" as const, index })),
  ];
  const [open, setOpen] = useState<number | null>(null);
  const current = open === null ? null : shots[open];

  if (!shots.length) return <p className="text-subtle">No screenshots available in this storefront.</p>;

  const go = (delta: number) => setOpen((i) => (i === null ? i : (i + delta + shots.length) % shots.length));

  return (
    <div className="flex flex-col gap-5">
      <Strip title="iPhone" shots={shots.filter((s) => s.device === "iPhone")} onOpen={(s) => setOpen(shots.indexOf(s))} />
      <Strip title="iPad" shots={shots.filter((s) => s.device === "iPad")} onOpen={(s) => setOpen(shots.indexOf(s))} />
      <Dialog open={current !== null} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent
          className="max-w-[min(1100px,calc(100%-2rem))]"
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") go(1);
            if (e.key === "ArrowLeft") go(-1);
          }}
        >
          {current && (
            <div className="flex flex-col gap-4 p-5">
              <div className="flex flex-col gap-2 pr-10">
                <DialogTitle>
                  {current.device} screenshot {current.index + 1}
                </DialogTitle>
                <DialogDescription>Use the arrow keys to browse all {shots.length} screenshots.</DialogDescription>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="secondary" size="icon" aria-label="Previous screenshot" onClick={() => go(-1)} disabled={shots.length < 2}>
                  <ChevronLeft aria-hidden className="size-4" />
                </Button>
                <div className="flex min-w-0 flex-1 justify-center">
                  <Image
                    src={large(current.url)}
                    alt={`${current.device} screenshot ${current.index + 1}`}
                    width={1200}
                    height={1200}
                    unoptimized
                    className="border-border h-auto max-h-[72dvh] w-auto max-w-full rounded-lg border object-contain"
                  />
                </div>
                <Button variant="secondary" size="icon" aria-label="Next screenshot" onClick={() => go(1)} disabled={shots.length < 2}>
                  <ChevronRight aria-hidden className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
