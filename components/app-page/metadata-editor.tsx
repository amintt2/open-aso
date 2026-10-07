"use client";

import { Info, Trash2 } from "lucide-react";
import { toast } from "sonner";
import Button from "@/components/_ui/button";
import Tag from "@/components/_ui/tag";
import { localeName, sameLocale } from "@/lib/asc/locales";
import { METADATA_LIMITS, type AppMetadata, type LocaleMetadata, type MetadataField } from "@/lib/asc/types";
import CharField from "./char-field";
import KeywordCoverage from "./keyword-coverage";
import KeywordsField from "./keywords-field";
import { appendKeywordWords } from "./keyword-utils";

export type FieldAccess = Record<MetadataField, { editable: boolean; reason?: string }>;

const NEEDS_VERSION = "Create a new version in App Store Connect first";

export function fieldAccess(meta: AppMetadata): FieldAccess {
  const info = { editable: !!meta.appInfo?.editable, reason: meta.appInfo ? NEEDS_VERSION : "No app info record" };
  const version = { editable: !!meta.version?.editable, reason: meta.version ? NEEDS_VERSION : "No App Store version yet" };
  return {
    name: info,
    subtitle: info,
    privacyPolicyUrl: info,
    privacyChoicesUrl: info,
    keywords: version,
    description: version,
    whatsNew: version,
    marketingUrl: version,
    supportUrl: version,
    promotionalText: { editable: !!meta.version, reason: "No App Store version yet" },
  };
}

export function humanState(state: string) {
  const s = state.replaceAll("_", " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

type Props = {
  appId: number;
  meta: AppMetadata;
  loc: LocaleMetadata;
  preferredCountry: string;
  value: (field: MetadataField) => string;
  isDirty: (field: MetadataField) => boolean;
  onChange: (field: MetadataField, value: string) => void;
  onDelete: () => void;
};

export default function MetadataEditor({ appId, meta, loc, preferredCountry, value, isDirty, onChange, onDelete }: Props) {
  const access = fieldAccess(meta);
  const primary = sameLocale(loc.locale, meta.primaryLocale);
  const field = (f: MetadataField) => ({
    id: `meta-${f}`,
    value: value(f),
    onChange: (v: string) => onChange(f, v),
    disabled: !access[f].editable,
    lockedReason: access[f].reason,
    dirty: isDirty(f),
  });
  const canDelete = !primary && (access.name.editable || access.keywords.editable);

  function addWords(words: string[]) {
    const { value: next, fitted } = appendKeywordWords(value("keywords"), words, METADATA_LIMITS.keywords);
    if (next !== value("keywords")) onChange("keywords", next);
    if (!fitted) toast.warning("Not enough room left in the 100-character keyword field");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-0 xl:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-5 overflow-y-auto p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2>{localeName(loc.locale)}</h2>
          <span className="caption-style text-subtle">{loc.locale}</span>
          {primary && (
            <Tag size="sm" tone="blue" className="text-[12px]">
              Primary
            </Tag>
          )}
          <span className="flex-1" />
          {canDelete && (
            <Button variant="ghost" size="sm" onClick={onDelete}>
              <Trash2 aria-hidden className="size-3.5" />
              Delete locale
            </Button>
          )}
        </div>

        <VersionBanner meta={meta} />

        <div className="grid gap-4 md:grid-cols-2">
          <CharField {...field("name")} label="Name" limit={METADATA_LIMITS.name} />
          <CharField {...field("subtitle")} label="Subtitle" limit={METADATA_LIMITS.subtitle} />
        </div>
        <KeywordsField {...field("keywords")} name={value("name")} subtitle={value("subtitle")} />
        <CharField
          {...field("promotionalText")}
          label="Promotional text"
          limit={METADATA_LIMITS.promotionalText}
          multiline
          rows={3}
          hint="Not indexed for search. Can be updated at any time without a new version."
        />
        <CharField {...field("description")} label="Description" limit={METADATA_LIMITS.description} multiline rows={12} hint="Not indexed for search on the App Store, but drives conversion." />
        <CharField {...field("whatsNew")} label="What's New" limit={METADATA_LIMITS.whatsNew} multiline rows={5} />
        <details className="border-border group rounded-xl border">
          <summary className="caption-style text-soft cursor-pointer list-none px-4 py-3 select-none">URLs</summary>
          <div className="grid gap-4 px-4 pb-4 md:grid-cols-2">
            <CharField {...field("supportUrl")} label="Support URL" type="url" placeholder="https://" />
            <CharField {...field("marketingUrl")} label="Marketing URL" type="url" placeholder="https://" />
            <CharField {...field("privacyPolicyUrl")} label="Privacy policy URL" type="url" placeholder="https://" />
            <CharField {...field("privacyChoicesUrl")} label="Privacy choices URL" type="url" placeholder="https://" />
          </div>
        </details>
      </div>
      <aside className="border-border flex max-h-[50vh] min-h-0 shrink-0 flex-col border-t p-5 xl:max-h-none xl:w-[320px] xl:border-t-0 xl:border-l">
        <KeywordCoverage
          appId={appId}
          locale={loc.locale}
          preferredCountry={preferredCountry}
          fields={{ name: value("name"), subtitle: value("subtitle"), keywords: value("keywords") }}
          onAddWords={access.keywords.editable ? addWords : undefined}
        />
      </aside>
    </div>
  );
}

function VersionBanner({ meta }: { meta: AppMetadata }) {
  const v = meta.version;
  if (v?.editable)
    return (
      <p className="caption-style text-subtle">
        Editing version {v.versionString} · {humanState(v.state)}
        {meta.liveVersion ? ` · live: ${meta.liveVersion.versionString}` : ""}
      </p>
    );
  return (
    <div className="border-(--tag-blue-border) bg-(--tag-blue-bg) text-(--tag-blue-text) flex items-start gap-2 rounded-lg border px-3 py-2.5">
      <Info aria-hidden className="mt-px size-3.5 shrink-0" />
      <p className="leading-[1.4]">
        {v
          ? `Version ${v.versionString} is ${humanState(v.state).toLowerCase()} and can't be edited. Create a new version in App Store Connect first to change keywords, description and What's New. Promotional text can still be updated.`
          : "This app has no App Store version yet. Create one in App Store Connect first."}
        {meta.appInfo && !meta.appInfo.editable ? " Name and subtitle unlock together with the new version." : ""}
      </p>
    </div>
  );
}
