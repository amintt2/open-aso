"use client";

import { Loader2 } from "lucide-react";
import CountrySelect from "@/components/shell/country-select";
import AppIcon from "@/components/shell/app-icon";
import { useAppCountry } from "@/hooks/use-app";
import { getCountry } from "@/lib/appstore/countries";
import { useApi } from "@/lib/client/api";
import type { StoreApp, TrackedApp } from "@/lib/client/types";
import { METADATA_LIMITS } from "@/lib/asc/types";
import { CharCounter } from "./char-field";
import KeywordCoverage from "./keyword-coverage";

function Block({ label, limit, value, multiline }: { label: string; limit?: number; value: string; multiline?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="caption-style text-soft">{label}</span>
        {limit !== undefined && <CharCounter value={value} limit={limit} />}
      </div>
      <div className={multiline ? "bg-secondary border-line-strong max-h-[360px] overflow-y-auto rounded-lg border px-3 py-2.5" : "bg-secondary border-line-strong rounded-lg border px-3 py-2.5"}>
        {value ? <p className="leading-[1.45] break-words whitespace-pre-wrap">{value}</p> : <p className="text-subtle">Not available</p>}
      </div>
    </div>
  );
}

function Shots({ title, urls }: { title: string; urls: string[] }) {
  if (!urls.length) return null;
  return (
    <section className="flex flex-col gap-3" aria-label={`${title} screenshots`}>
      <h3 className="caption-style text-soft">
        {title} <span className="text-subtle">· {urls.length}</span>
      </h3>
      <ul className="flex gap-3 overflow-x-auto pb-2">
        {urls.map((u) => (
          <li key={u} className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt="" loading="lazy" className="border-border h-[280px] w-auto rounded-lg border object-contain" />
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function PublicPreview({ app }: { app: TrackedApp }) {
  const [country, setCountry] = useAppCountry(app);
  const { data, isLoading, error } = useApi<StoreApp[]>(`/api/store/lookup?id=${app.trackId}&country=${country}`);
  const store = data?.[0];
  const locale = getCountry(country).indexedLocales[0];

  return (
    <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-5 overflow-y-auto p-5">
        <div className="flex flex-wrap items-center gap-3">
          <AppIcon src={app.iconUrl} name={app.name} className="size-10" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="lead-style truncate font-medium">{store?.trackName ?? app.name}</span>
            <span className="caption-style text-subtle truncate">
              Public listing · version {store?.version ?? "—"} · read-only
            </span>
          </div>
          <CountrySelect value={country} onChange={setCountry} />
        </div>
        {isLoading ? (
          <p className="text-subtle flex items-center gap-2">
            <Loader2 aria-hidden className="size-3.5 animate-spin" /> Loading the public listing…
          </p>
        ) : error || !store ? (
          <p className="text-subtle">{error instanceof Error ? error.message : "This app isn't available in this storefront."}</p>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <Block label="Name" limit={METADATA_LIMITS.name} value={store.trackName} />
              <Block label="Subtitle" limit={METADATA_LIMITS.subtitle} value={app.subtitle ?? ""} />
            </div>
            <Block label="Description" limit={METADATA_LIMITS.description} value={store.description} multiline />
            {store.releaseNotes && <Block label="What's New" limit={METADATA_LIMITS.whatsNew} value={store.releaseNotes} multiline />}
            <Shots title="iPhone" urls={store.screenshotUrls} />
            <Shots title="iPad" urls={store.ipadScreenshotUrls} />
          </>
        )}
      </div>
      <aside className="border-border flex max-h-[50vh] min-h-0 shrink-0 flex-col gap-3 border-t p-5 xl:max-h-none xl:w-[320px] xl:border-t-0 xl:border-l">
        <KeywordCoverage
          appId={app.id}
          locale={locale}
          preferredCountry={country}
          fields={{ name: store?.trackName ?? app.name, subtitle: app.subtitle ?? "", keywords: "" }}
        />
        <p className="caption-style text-subtle leading-[1.4]">The keyword field is private — coverage here only uses the public name and subtitle.</p>
      </aside>
    </div>
  );
}
