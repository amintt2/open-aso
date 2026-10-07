"use client";

import { useMemo, useState } from "react";
import { KeyRound, Loader2, Plus } from "lucide-react";
import Button from "@/components/_ui/button";
import Tag from "@/components/_ui/tag";
import CountrySelect from "@/components/shell/country-select";
import { ScoreBar } from "@/components/shell/score";
import { COUNTRIES } from "@/lib/appstore/countries";
import { useApi } from "@/lib/client/api";
import type { TrackedKeyword } from "@/lib/client/types";
import { cn } from "@/lib/utils";
import { coverage, type CoverageField } from "./keyword-utils";

const FIELD_LABEL: Record<CoverageField, string> = { name: "name", subtitle: "subtitle", keywords: "keywords" };

export function countriesIndexing(locale: string) {
  return COUNTRIES.filter((c) => c.indexedLocales.some((l) => l.toLowerCase() === locale.toLowerCase())).map((c) => c.code);
}

type Props = {
  appId: number;
  locale: string;
  preferredCountry: string;
  fields: Record<CoverageField, string>;
  onAddWords?: (words: string[]) => void;
  className?: string;
};

export default function KeywordCoverage({ appId, locale, preferredCountry, fields, onAddWords, className }: Props) {
  const options = useMemo(() => countriesIndexing(locale), [locale]);
  const [picked, setPicked] = useState<string | null>(null);
  const country = picked && options.includes(picked) ? picked : options.includes(preferredCountry) ? preferredCountry : (options[0] ?? null);
  const { data, isLoading, error } = useApi<TrackedKeyword[]>(country ? `/api/apps/${appId}/keywords?country=${country}` : null);

  const rows = useMemo(
    () =>
      (data ?? [])
        .map((k) => ({ k, c: coverage(k.term, fields) }))
        .sort((a, b) => (b.k.popularity ?? -1) - (a.k.popularity ?? -1)),
    [data, fields],
  );
  const covered = rows.filter((r) => r.c.status === "full").length;

  return (
    <section aria-label="Tracked keyword coverage" className={cn("flex min-h-0 flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="lead-style font-medium whitespace-nowrap">Keyword coverage</h3>
        {country && options.length > 1 && <CountrySelect value={country} onChange={setPicked} only={options} className="min-w-[130px]" />}
      </div>
      {!country ? (
        <p className="caption-style text-subtle leading-[1.4]">No supported storefront indexes {locale}. Metadata in this locale won&apos;t affect search in the tracked countries.</p>
      ) : isLoading ? (
        <p className="text-subtle flex items-center gap-2">
          <Loader2 aria-hidden className="size-3.5 animate-spin" /> Loading tracked keywords…
        </p>
      ) : error ? (
        <p className="caption-style text-danger">{error instanceof Error ? error.message : "Could not load keywords"}</p>
      ) : !rows.length ? (
        <div className="text-subtle flex items-start gap-2">
          <KeyRound aria-hidden className="mt-px size-3.5 shrink-0" />
          <p className="caption-style leading-[1.4]">No keywords tracked in this storefront yet. Track keywords to see which ones this metadata covers.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <span className="caption-style text-soft">
              {covered} of {rows.length} fully covered · indexed in {options.length} storefront{options.length > 1 ? "s" : ""}
            </span>
            <span className="bg-track block h-1 overflow-hidden rounded-full">
              <span className="bg-success block h-full rounded-full" style={{ width: `${(covered / rows.length) * 100}%` }} />
            </span>
          </div>
          <ul className="divide-border flex flex-col divide-y overflow-y-auto">
            {rows.map(({ k, c }) => (
              <li key={k.id} className="flex flex-col gap-2 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[13px]">{k.term}</span>
                  <Tag size="sm" className="text-[11px]" tone={c.status === "full" ? "green" : c.status === "partial" ? "amber" : "neutral"}>
                    {c.status === "full" ? "Covered" : c.status === "partial" ? "Partial" : "Missing"}
                  </Tag>
                  {onAddWords && c.missing.length > 0 && (
                    <Button variant="ghost" size="icon-sm" aria-label={`Add ${c.missing.join(" ")} to keywords`} title={`Add “${c.missing.join(", ")}” to keywords`} onClick={() => onAddWords(c.missing)}>
                      <Plus aria-hidden className="size-3.5" />
                    </Button>
                  )}
                </div>
                <div className="caption-style text-subtle flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="inline-flex items-center gap-1">
                    Pop <ScoreBar value={k.popularity} />
                  </span>
                  <span className="inline-flex items-center gap-1">
                    Diff <ScoreBar value={k.difficulty} invert />
                  </span>
                  {c.fields.length > 0 && <span>in {c.fields.map((f) => FIELD_LABEL[f]).join(" + ")}</span>}
                  {c.status === "partial" && <span>missing {c.missing.join(", ")}</span>}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
