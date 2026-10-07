"use client";

import { useState } from "react";
import { Check, Layers, Plus, X } from "lucide-react";
import Button from "@/components/_ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/_ui/sheet";
import CountrySelect from "@/components/shell/country-select";
import { COUNTRIES, getCountry } from "@/lib/appstore/countries";
import { localeName } from "@/lib/asc/locales";
import { METADATA_LIMITS, type AppMetadata, type MetadataField } from "@/lib/asc/types";
import { UsageBar } from "./char-field";
import { charCount, words } from "./keyword-utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meta: AppMetadata;
  value: (locale: string, field: MetadataField) => string;
  canAdd: boolean;
  onAddLocale: (locale: string) => void;
  onOpenLocale: (locale: string) => void;
};

const MULTI = COUNTRIES.filter((c) => c.indexedLocales.length > 2).map((c) => c.code);

export default function UsMultiplierSheet({ open, onOpenChange, meta, value, canAdd, onAddLocale, onOpenLocale }: Props) {
  const [country, setCountry] = useState("us");
  const c = getCountry(country);
  const seen = new Set<string>();
  const rows = c.indexedLocales.map((code) => {
    const loc = meta.localizations.find((l) => l.locale.toLowerCase() === code.toLowerCase());
    const name = loc ? value(loc.locale, "name") : "";
    const subtitle = loc ? value(loc.locale, "subtitle") : "";
    const keywords = loc ? value(loc.locale, "keywords") : "";
    const all = [...new Set(words(`${name} ${subtitle} ${keywords.replaceAll(",", " ")}`))];
    const fresh = all.filter((w) => !seen.has(w));
    all.forEach((w) => seen.add(w));
    return { code, loc, name, subtitle, keywordChars: charCount(keywords), fresh: fresh.length, total: all.length };
  });
  const existing = rows.filter((r) => r.loc);
  const used = existing.reduce((n, r) => n + r.keywordChars, 0);
  const capacity = rows.length * METADATA_LIMITS.keywords;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[560px] max-w-[100vw]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Layers aria-hidden className="text-soft size-4" />
            Storefront multiplier
          </SheetTitle>
          <span className="flex items-center gap-2">
            <CountrySelect value={country} onChange={setCountry} only={MULTI} />
            <SheetClose asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Close">
                <X aria-hidden className="size-4" />
              </Button>
            </SheetClose>
          </span>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
          <SheetDescription className="p-style text-soft leading-[1.45]">
            The {c.name} App Store indexes {c.indexedLocales.length} localizations, not just {c.indexedLocales[0]}. Name, subtitle and keywords from every one of them count for search in {c.name} — that&apos;s {c.indexedLocales.length} × 100 keyword characters instead of 100. Fill the extra locales with additional {c.name === "United States" ? "English" : "local"} keywords (no need to translate) to rank for more terms.
          </SheetDescription>
          <div className="border-border bg-card grid grid-cols-3 gap-3 rounded-xl border p-4">
            <Stat label="Locales in use" value={`${existing.length}/${rows.length}`} />
            <Stat label="Keyword chars" value={`${used}/${capacity}`} />
            <Stat label="Unique words indexed" value={String(seen.size)} />
          </div>
          <ul className="divide-border flex flex-col divide-y">
            {rows.map((r) => (
              <li key={r.code} className="flex items-center gap-3 py-3">
                <span className={r.loc ? "bg-(--tag-green-bg) text-(--tag-green-text) flex size-6 shrink-0 items-center justify-center rounded-full" : "bg-secondary text-subtle flex size-6 shrink-0 items-center justify-center rounded-full"}>
                  {r.loc ? <Check aria-label="Exists" className="size-3.5" /> : <Plus aria-label="Missing" className="size-3.5" />}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="flex items-baseline gap-1.5 text-[13px]">
                    {localeName(r.code)} <span className="caption-style text-subtle">{r.code}</span>
                  </span>
                  {r.loc ? (
                    <>
                      <span className="caption-style text-subtle">
                        name {charCount(r.name)}/30 · subtitle {charCount(r.subtitle)}/30 · keywords {r.keywordChars}/100 · {r.fresh} new word{r.fresh === 1 ? "" : "s"}
                      </span>
                      <UsageBar value={r.keywordChars} limit={METADATA_LIMITS.keywords} />
                    </>
                  ) : (
                    <span className="caption-style text-subtle">Not created — 160 extra indexed characters unused</span>
                  )}
                </div>
                {r.loc ? (
                  <Button variant="ghost" size="sm" onClick={() => r.loc && onOpenLocale(r.loc.locale)}>
                    Edit
                  </Button>
                ) : (
                  <Button variant="secondary" size="sm" disabled={!canAdd} title={canAdd ? undefined : "Create a new version in App Store Connect first"} onClick={() => onAddLocale(r.code)}>
                    Add
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <p className="caption-style text-subtle leading-[1.4]">
            Words already used in an earlier locale in this list don&apos;t add reach — repeating them across locales only wastes characters. Indexing rules are based on observed App Store behaviour and can change.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="caption-style text-subtle">{label}</span>
      <span className="lead-style tabular-nums">{value}</span>
    </div>
  );
}
