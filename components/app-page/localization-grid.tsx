"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import { localeName, sameLocale } from "@/lib/asc/locales";
import { METADATA_LIMITS, type AppMetadata, type MetadataField } from "@/lib/asc/types";
import { cn } from "@/lib/utils";
import { UsageBar } from "./char-field";
import { charCount } from "./keyword-utils";

const COLUMNS = ["name", "subtitle", "keywords", "promotionalText", "description", "whatsNew"] as const;
const LABEL: Record<(typeof COLUMNS)[number], string> = {
  name: "Name",
  subtitle: "Subtitle",
  keywords: "Keywords",
  promotionalText: "Promo text",
  description: "Description",
  whatsNew: "What's New",
};

type Props = {
  meta: AppMetadata;
  value: (locale: string, field: MetadataField) => string;
  dirtyLocales: Set<string>;
  onOpen: (locale: string) => void;
};

export default function LocalizationGrid({ meta, value, dirtyLocales, onOpen }: Props) {
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <Table>
        <TableHeader className="bg-background sticky top-0 z-10">
          <TableRow>
            <TableHead className="pl-5">Locale</TableHead>
            {COLUMNS.map((c) => (
              <TableHead key={c} className="min-w-[150px]">
                {LABEL[c]} <span className="text-faint">/ {METADATA_LIMITS[c]}</span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {meta.localizations.map((loc) => (
            <TableRow key={loc.locale} className="cursor-pointer hover:bg-white/3" onClick={() => onOpen(loc.locale)}>
              <TableCell className="h-auto py-2.5 pl-5">
                <span className="flex items-center gap-1.5">
                  {dirtyLocales.has(loc.locale) && <span className="bg-status size-1.5 rounded-full" aria-label="edited" />}
                  <span className="flex flex-col gap-1">
                    <span className="text-[13px]">{localeName(loc.locale)}</span>
                    <span className="caption-style text-subtle">
                      {loc.locale}
                      {sameLocale(loc.locale, meta.primaryLocale) ? " · primary" : ""}
                    </span>
                  </span>
                </span>
              </TableCell>
              {COLUMNS.map((c) => {
                const text = value(loc.locale, c);
                const n = charCount(text);
                const limit = METADATA_LIMITS[c];
                return (
                  <TableCell key={c} title={text || undefined} className="h-auto max-w-[220px] py-2.5">
                    <span className="flex flex-col gap-1.5">
                      <span className={cn("caption-style tabular-nums", n > limit ? "text-danger" : n ? "text-soft" : "text-faint")}>
                        {n ? `${n}/${limit} · ${Math.round((n / limit) * 100)}%` : "empty"}
                      </span>
                      <UsageBar value={n} limit={limit} />
                      {(c === "name" || c === "subtitle" || c === "keywords") && text && <span className="caption-style text-subtle truncate">{text}</span>}
                    </span>
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
