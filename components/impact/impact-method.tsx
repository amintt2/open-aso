"use client";

import { useState, type FormEvent } from "react";
import { ChevronRight } from "lucide-react";
import { toast } from "sonner";
import Button from "@/components/_ui/button";
import { Input } from "@/components/_ui/input";
import { api, revalidate } from "@/lib/client/api";
import type { ImpactResult } from "@/lib/impact/types";

export default function ImpactMethod({ data }: { data: ImpactResult }) {
  const pct = Math.round(data.searchShare * 100);
  const [value, setValue] = useState(String(pct));
  const [saving, setSaving] = useState(false);
  const source = data.demo
    ? "demo installs"
    : data.dataSources.observed === "posthog"
      ? "PostHog new users"
      : data.dataSources.observed === "sdk"
        ? "Open ASO SDK installs"
        : data.dataSources.observed === "apple"
          ? "Apple's first-time downloads (App Store Analytics)"
          : null;
  const appleSearch = data.dataSources.calibration === "apple_search";

  async function save(e: FormEvent) {
    e.preventDefault();
    const n = Number(value);
    if (!Number.isFinite(n) || n < 5 || n > 100) return toast.error("Enter a share between 5 and 100%");
    setSaving(true);
    try {
      await api("/api/impact", { method: "PUT", body: { searchShare: n / 100 } });
      await revalidate("/api/impact");
      toast.success(`Search share set to ${n}%`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <details className="group bg-card border-border rounded-xl border">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 select-none [&::-webkit-details-marker]:hidden">
        <ChevronRight aria-hidden className="text-subtle size-4 transition-transform duration-150 group-open:rotate-90" />
        <h2 className="h3-style">How this is estimated</h2>
        <span className="caption-style text-subtle">Modelled estimate, not Apple data</span>
      </summary>
      <div className="flex flex-col gap-4 px-4 pb-4">
        <ul className="text-soft flex list-disc flex-col gap-2 pl-5">
          <li>
            {source ? `Observed installs come from ${source}` : "No install data is connected, so nothing is calibrated"}; Apple Ads installs for this app&apos;s campaigns are subtracted to get organic installs per country and day.
          </li>
          <li>
            {appleSearch
              ? "Search installs come straight from Apple: App Store search first-time downloads per territory and day (App Store Analytics), minus Apple Ads installs. Days Apple hasn't published yet use the window's daily average."
              : `${pct}% of organic installs are assumed to come from App Store search; the remaining ${100 - pct}% is counted as browse & referral.`}
          </li>
          <li>
            Each keyword&apos;s raw potential is its monthly searches (from popularity) × the tap share at its daily rank × 40% conversion. Per country these are scaled by one factor (kept between 0.2× and 5×) so they add up to the search installs; whatever tracked keywords can&apos;t explain shows as other searches.
          </li>
          <li>
            Revenue = estimated installs × net revenue per new user in that country (refunds deducted, sandbox excluded; app-wide average for small countries). Apple Ads keywords use SDK-attributed revenue when available.
          </li>
        </ul>
        <form onSubmit={save} className="flex flex-wrap items-center gap-2">
          <label htmlFor="impact-search-share" className="caption-style text-subtle">
            Search share of organic installs
          </label>
          <span className="relative">
            <Input id="impact-search-share" type="number" min={5} max={100} step={1} value={value} onChange={(e) => setValue(e.target.value)} className="h-[30px] w-[84px] pr-6 tabular-nums" />
            <span className="caption-style text-subtle pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2">%</span>
          </span>
          <Button type="submit" variant="secondary" size="sm" disabled={saving || Number(value) === pct}>
            Save
          </Button>
          <span className="caption-style text-subtle">Workspace setting · admins only · default 65%</span>
        </form>
      </div>
    </details>
  );
}
