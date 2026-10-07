"use client";

import { useId, useMemo, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import Button from "@/components/_ui/button";
import { Label } from "@/components/_ui/label";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/_ui/sheet";
import CountrySelect from "@/components/shell/country-select";
import { api, useApi } from "@/lib/client/api";
import type { TrackedKeyword } from "@/lib/client/types";
import { MAX_TERM_LENGTH, parseTerms } from "@/lib/keywords/table";
import { cn } from "@/lib/utils";

const MAX_TERMS = 200;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appId: number;
  defaultCountry: string;
  onAdded: (country: string, added: TrackedKeyword[]) => void;
};

type Chip = { term: string; state: "new" | "tracked" | "long" };

export default function AddKeywordsSheet({
  open,
  onOpenChange,
  appId,
  defaultCountry,
  onAdded,
}: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[460px]">
        {open && (
          <AddKeywordsForm
            appId={appId}
            defaultCountry={defaultCountry}
            onAdded={onAdded}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function AddKeywordsForm({
  appId,
  defaultCountry,
  onAdded,
}: Omit<Props, "open" | "onOpenChange">) {
  const id = useId();
  const [country, setCountry] = useState(defaultCountry);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { data: existing, isLoading } = useApi<TrackedKeyword[]>(
    `/api/apps/${appId}/keywords?country=${country}`,
  );

  const chips = useMemo<Chip[]>(() => {
    const tracked = new Set(existing?.map((k) => k.term));
    return parseTerms(text).map((term) => ({
      term,
      state:
        term.length > MAX_TERM_LENGTH
          ? "long"
          : tracked.has(term)
            ? "tracked"
            : "new",
    }));
  }, [text, existing]);

  const fresh = chips.filter((c) => c.state === "new").map((c) => c.term);
  const skipped = chips.length - fresh.length;
  const tooMany = fresh.length > MAX_TERMS;

  function removeChip(term: string) {
    setText(
      parseTerms(text)
        .filter((t) => t !== term)
        .join("\n"),
    );
  }

  async function submit() {
    if (!fresh.length || tooMany) return;
    setSubmitting(true);
    try {
      const list = await api<TrackedKeyword[]>(`/api/apps/${appId}/keywords`, {
        method: "POST",
        body: { terms: fresh, country, analyze: false },
      });
      const wanted = new Set(fresh);
      onAdded(
        country,
        list.filter((k) => wanted.has(k.term)),
      );
      toast.success(
        `${fresh.length} keyword${fresh.length === 1 ? "" : "s"} added — analyzing now`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add keywords");
      setSubmitting(false);
    }
  }

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <SheetHeader>
        <SheetTitle>Add keywords</SheetTitle>
        <SheetClose asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Close">
            <X aria-hidden className="size-4" />
          </Button>
        </SheetClose>
      </SheetHeader>
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
        <SheetDescription>
          Keywords are analyzed for the selected storefront: popularity,
          difficulty, your ranking and the top apps.
        </SheetDescription>
        <div className="flex flex-col gap-2">
          <span className="caption-style text-soft">Country</span>
          <CountrySelect
            value={country}
            onChange={setCountry}
            className="h-9 w-full rounded-lg"
          />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor={`${id}-terms`}>Keywords</Label>
            <span className="caption-style text-subtle">
              Separate with commas or new lines
            </span>
          </div>
          <textarea
            id={`${id}-terms`}
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void submit();
              }
            }}
            rows={7}
            placeholder={"photo editor\ncollage maker, story templates"}
            className="border-line-strong bg-secondary placeholder:text-subtle focus-visible:border-ring min-h-[140px] w-full resize-y rounded-lg border px-3 py-2.5 text-[14px] leading-[1.4] transition-[border-color] duration-150 outline-none"
          />
        </div>
        {chips.length > 0 && (
          <div className="flex flex-col gap-2.5">
            <div className="caption-style text-subtle flex items-center justify-between">
              <span>
                {fresh.length} new{skipped ? ` · ${skipped} skipped` : ""}
              </span>
              {isLoading && (
                <Loader2
                  aria-label="Checking tracked keywords"
                  className="size-3 animate-spin"
                />
              )}
            </div>
            <ul className="flex flex-wrap gap-1.5" aria-label="Keywords to add">
              {chips.map((c) => (
                <li
                  key={c.term}
                  title={
                    c.state === "tracked"
                      ? "Already tracked in this country"
                      : c.state === "long"
                        ? `Longer than ${MAX_TERM_LENGTH} characters`
                        : undefined
                  }
                  className={cn(
                    "caption-style inline-flex h-[26px] max-w-full items-center gap-1 rounded-full border pr-1 pl-2.5",
                    c.state === "new" &&
                      "border-line-strong bg-muted text-foreground",
                    c.state === "tracked" && "text-subtle border-border",
                    c.state === "long" &&
                      "border-(--tag-red-border) bg-(--tag-red-bg) text-(--tag-red-text)",
                  )}
                >
                  <span
                    className={cn(
                      "truncate",
                      c.state === "tracked" && "line-through",
                    )}
                  >
                    {c.term}
                  </span>
                  {c.state === "tracked" && (
                    <span className="text-faint">tracked</span>
                  )}
                  <button
                    type="button"
                    aria-label={`Remove ${c.term}`}
                    onClick={() => removeChip(c.term)}
                    className="focus-visible:ring-ring/60 flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full outline-none hover:bg-white/10 focus-visible:ring-2"
                  >
                    <X aria-hidden className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
            {tooMany && (
              <span role="alert" className="caption-style text-danger">
                Add at most {MAX_TERMS} keywords at a time.
              </span>
            )}
          </div>
        )}
      </div>
      <SheetFooter>
        <span className="caption-style text-subtle">⌘↵ to add</span>
        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={!fresh.length || tooMany || submitting}
        >
          {submitting ? (
            <Loader2 aria-hidden className="size-3.5 animate-spin" />
          ) : (
            <Plus aria-hidden className="size-3.5" />
          )}
          {fresh.length
            ? `Add ${fresh.length} keyword${fresh.length === 1 ? "" : "s"}`
            : "Add keywords"}
        </Button>
      </SheetFooter>
    </form>
  );
}
