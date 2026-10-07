"use client";

import { ImageOff, Loader2 } from "lucide-react";
import EmptyState from "@/components/shell/empty-state";
import AscErrorPanel from "@/components/asc/asc-error";
import { useApi } from "@/lib/client/api";
import { localeName } from "@/lib/asc/locales";
import type { ScreenshotSet } from "@/lib/asc/types";

const NAMED: Record<string, string> = {
  APP_DESKTOP: "Mac",
  APP_APPLE_TV: "Apple TV",
  APP_APPLE_VISION_PRO: "Apple Vision Pro",
  APP_WATCH_ULTRA: "Apple Watch Ultra",
  APP_IPAD_PRO_3GEN_129: 'iPad Pro 12.9" (3rd gen+) / 13"',
  APP_IPAD_PRO_3GEN_11: 'iPad Pro 11"',
  APP_IPAD_PRO_129: 'iPad Pro 12.9" (2nd gen)',
};

export function displayTypeLabel(type: string) {
  if (NAMED[type]) return NAMED[type];
  const imessage = type.startsWith("IMESSAGE_");
  const base = type.replace(/^IMESSAGE_/, "").replace(/^APP_/, "");
  const m = base.match(/^(IPHONE|IPAD)_(\d)(\d+)$/);
  const label = m ? `${m[1] === "IPHONE" ? "iPhone" : "iPad"} ${m[2]}.${m[3]}"` : base.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
  return imessage ? `iMessage · ${label}` : label;
}

export default function ScreenshotsTab({ appId, locale }: { appId: number; locale: string }) {
  const { data, error, isLoading, mutate } = useApi<ScreenshotSet[]>(`/api/asc/apps/${appId}/screenshots?locale=${encodeURIComponent(locale)}`);
  if (error) return <AscErrorPanel error={error} title="Could not load screenshots" onRetry={() => void mutate()} />;
  if (isLoading || !data)
    return (
      <div className="text-subtle flex flex-1 items-center justify-center gap-2 py-16">
        <Loader2 aria-hidden className="size-4 animate-spin" /> Loading screenshots…
      </div>
    );
  const sets = data.filter((s) => s.screenshots.length);
  if (!sets.length)
    return <EmptyState icon={ImageOff} title={`No screenshots for ${localeName(locale)}`} description="Locales without their own screenshots fall back to the primary locale's set on the App Store." />;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-5">
      <p className="caption-style text-subtle">
        {localeName(locale)} · {sets.length} device size{sets.length === 1 ? "" : "s"} · read-only, upload in App Store Connect
      </p>
      {sets.map((set) => (
        <section key={set.id} className="flex flex-col gap-3" aria-label={displayTypeLabel(set.displayType)}>
          <h3 className="caption-style text-soft">
            {displayTypeLabel(set.displayType)} <span className="text-subtle">· {set.screenshots.length}</span>
          </h3>
          <ul className="flex gap-3 overflow-x-auto pb-2">
            {set.screenshots.map((s) => (
              <li key={s.id} className="shrink-0">
                {s.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.url} alt={s.fileName ?? ""} loading="lazy" className="border-border h-[300px] w-auto rounded-lg border object-contain" />
                ) : (
                  <div className="border-border text-subtle caption-style flex h-[300px] w-[140px] items-center justify-center rounded-lg border p-3 text-center">{s.state ? s.state.replaceAll("_", " ").toLowerCase() : "processing"}</div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
