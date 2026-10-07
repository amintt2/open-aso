"use client";

import { useMemo, useState } from "react";
import { Loader2, Rocket } from "lucide-react";
import { toast } from "sonner";
import Button from "@/components/_ui/button";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import { Checkbox } from "@/components/_ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/_ui/select";
import CountrySelect from "@/components/shell/country-select";
import AppIcon from "@/components/shell/app-icon";
import { ScoreBar } from "@/components/shell/score";
import { api, useApi } from "@/lib/client/api";
import type { TrackedApp, TrackedKeyword } from "@/lib/client/types";
import type { CampaignPlan, CampaignPlanInput } from "@/lib/apple-ads/types";
import { SAFE_DEFAULTS } from "@/lib/apple-ads/knowledge";
import { cn } from "@/lib/utils";
import { DetailSheet } from "./bits";
import { useRequestChange } from "./change-provider";
import { parseTerms } from "./format";
import { useAdsUi } from "./store";

const DEMO_APP = { id: -1, trackId: 6400000001, name: "Stride Habits (demo)", iconUrl: null as string | null, primaryCountry: "us" };
const DEFAULT_PATTERN = "{App}_{CC}_{MatchType}_{Placement}";
const MATCH_OPTIONS: { value: CampaignPlanInput["matchType"]; label: string; hint: string }[] = [
  { value: "EXACT", label: "Exact", hint: "Recommended. Full control of bids per keyword." },
  { value: "BROAD", label: "Broad", hint: "Discovery. Close variants and related queries." },
  { value: "SEARCH_MATCH", label: "Search Match", hint: "Discovery. Apple picks queries from your metadata." },
];
const MATCH_LABEL = { EXACT: "Exact", BROAD: "Broad", SEARCH_MATCH: "SearchMatch" } as const;

function previewName(pattern: string, app: string, cc: string, match: CampaignPlanInput["matchType"]) {
  return pattern
    .replaceAll("{App}", app.replace(/[^\p{L}\p{N}]+/gu, "").slice(0, 40) || "App")
    .replaceAll("{CC}", cc.toUpperCase())
    .replaceAll("{MatchType}", MATCH_LABEL[match])
    .replaceAll("{Placement}", "SR");
}

function CreateCampaignForm({ onDone }: { onDone: () => void }) {
  const demo = useAdsUi((s) => s.demo);
  const request = useRequestChange();
  const { data: tracked = [] } = useApi<TrackedApp[]>("/api/apps");
  const apps = useMemo(() => {
    const list = tracked.filter((a) => a.isMine).map((a) => ({ id: a.id, trackId: a.trackId, name: a.name, iconUrl: a.iconUrl, primaryCountry: a.primaryCountry }));
    return demo ? [DEMO_APP, ...list] : list;
  }, [tracked, demo]);
  const [appId, setAppId] = useState<number | null>(null);
  const app = apps.find((a) => a.id === appId) ?? apps[0];
  const [countryPick, setCountry] = useState<string | null>(null);
  const country = countryPick ?? app?.primaryCountry ?? "us";
  const [matchType, setMatchType] = useState<CampaignPlanInput["matchType"]>("EXACT");
  const [budget, setBudget] = useState("20");
  const [bid, setBid] = useState("1.00");
  const [pattern, setPattern] = useState(DEFAULT_PATTERN);
  const [extra, setExtra] = useState("");
  const [busy, setBusy] = useState(false);

  const keywordUrl = app && app.id > 0 && matchType !== "SEARCH_MATCH" ? `/api/apps/${app.id}/keywords?country=${country}` : null;
  const { data: keywords = [], isLoading: loadingKeywords } = useApi<TrackedKeyword[]>(keywordUrl);
  const ranked = useMemo(() => [...keywords].sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0)), [keywords]);
  const selectionKey = `${app?.id}|${country}`;
  const [picked, setPicked] = useState<{ key: string; terms: Set<string> } | null>(null);
  const defaultPicked = useMemo(() => new Set(ranked.slice(0, 10).map((k) => k.term)), [ranked]);
  const selected = picked?.key === selectionKey ? picked.terms : defaultPicked;

  function toggle(term: string, on: boolean) {
    const next = new Set(selected);
    if (on) next.add(term);
    else next.delete(term);
    setPicked({ key: selectionKey, terms: next });
  }

  const name = app ? previewName(pattern, app.name.replace(" (demo)", ""), country, matchType) : "";
  const terms = [...new Set([...selected, ...parseTerms(extra)])];
  const budgetN = Number(budget);
  const bidN = Number(bid);
  const valid = !!app && budgetN > 0 && bidN > 0 && pattern.trim().length > 0;

  async function review() {
    if (!app || !valid) return;
    setBusy(true);
    try {
      const plan = await api<CampaignPlan>("/api/apple-ads/campaigns/plan", {
        method: "POST",
        body: {
          adamId: app.trackId,
          appName: app.name.replace(" (demo)", ""),
          countries: [country],
          dailyBudget: budgetN,
          defaultBid: bidN,
          matchType,
          namePattern: pattern,
          keywords: matchType === "SEARCH_MATCH" ? [] : terms.map((text) => ({ text })),
          demo,
        },
      });
      await request({ title: "Create campaign", description: "One campaign, one ad group and its keywords will be created in Apple Ads.", url: "/api/apple-ads/campaigns", method: "POST", body: { plan }, success: "Campaign created", onDone });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not plan the campaign");
    } finally {
      setBusy(false);
    }
  }

  if (!apps.length)
    return <p className="text-subtle p-6">Add your app to Open ASO first (sidebar → Add app, marked as yours). Campaigns promote the app&apos;s App Store ID.</p>;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="App" htmlFor="cc-app">
          <Select value={String(app?.id ?? "")} onValueChange={(v) => setAppId(Number(v))}>
            <SelectTrigger id="cc-app">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {apps.map((a) => (
                <SelectItem key={a.id} value={String(a.id)}>
                  <span className="inline-flex items-center gap-2">
                    <AppIcon src={a.iconUrl} name={a.name} className="size-4" />
                    {a.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Country (one per campaign)" htmlFor="cc-country">
          <CountrySelect value={country} onChange={setCountry} className="h-9 w-full rounded-lg" />
        </Field>
        <Field label="Daily budget" htmlFor="cc-budget" hint="Caps spend per day for this storefront.">
          <Input id="cc-budget" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} />
        </Field>
        <Field label="Default max CPT bid" htmlFor="cc-bid" hint="Start below Apple's suggested bid and adjust after 3+ days.">
          <Input id="cc-bid" inputMode="decimal" value={bid} onChange={(e) => setBid(e.target.value)} />
        </Field>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="caption-style text-soft mb-2">Match strategy</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {MATCH_OPTIONS.map((m) => (
            <button
              key={m.value}
              type="button"
              aria-pressed={matchType === m.value}
              onClick={() => setMatchType(m.value)}
              className={cn("border-line-strong hover:bg-white/4 flex cursor-pointer flex-col gap-1.5 rounded-lg border p-3 text-left transition-colors", matchType === m.value && "border-foreground/60 bg-white/4")}
            >
              <span className="text-[13px]">{m.label}</span>
              <span className="caption-style text-subtle leading-[1.3]">{m.hint}</span>
            </button>
          ))}
        </div>
        <p className="caption-style text-subtle">Placement: Search Results · Search Match {matchType === "SEARCH_MATCH" ? "on" : "off"}</p>
      </fieldset>

      <Field label="Naming pattern" htmlFor="cc-pattern" hint={`Tokens: {App} {CC} {MatchType} {Placement}. Preview: ${name}`}>
        <Input id="cc-pattern" value={pattern} onChange={(e) => setPattern(e.target.value)} />
      </Field>

      {matchType !== "SEARCH_MATCH" && (
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h3>Starter keywords</h3>
            <span className="caption-style text-subtle">{terms.length} selected · {matchType === "EXACT" ? "exact" : "broad"} match</span>
          </div>
          {app && app.id > 0 && (
            <div className="border-border max-h-[260px] overflow-y-auto rounded-lg border">
              {loadingKeywords && <p className="text-subtle p-3">Loading tracked keywords…</p>}
              {!loadingKeywords && !ranked.length && <p className="text-subtle p-3">No tracked keywords for this country yet. Add some below, or track keywords on the app&apos;s Keywords page.</p>}
              <ul className="divide-border divide-y">
                {ranked.map((k) => (
                  <li key={k.id} className="flex items-center gap-3 px-3 py-2">
                    <Checkbox id={`kw-${k.id}`} checked={selected.has(k.term)} onCheckedChange={(v) => toggle(k.term, v === true)} />
                    <label htmlFor={`kw-${k.id}`} className="flex-1 cursor-pointer truncate text-[13px]">
                      {k.term}
                    </label>
                    <span className="caption-style text-subtle">popularity</span>
                    <ScoreBar value={k.popularity} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Field label="More keywords" htmlFor="cc-extra" hint="Comma or new line separated.">
            <textarea
              id="cc-extra"
              rows={3}
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              className="bg-secondary border-line-strong focus-visible:border-ring placeholder:text-subtle w-full rounded-lg border p-3 text-[14px] outline-none"
              placeholder="habit tracker, daily routine"
            />
          </Field>
        </section>
      )}

      <details className="bg-card border-border rounded-lg border p-3">
        <summary className="caption-style text-soft cursor-pointer">Why these defaults</summary>
        <ul className="mt-3 flex flex-col gap-2">
          {SAFE_DEFAULTS.slice(0, 5).map((d) => (
            <li key={d.title} className="text-[13px]">
              <span className="text-foreground">{d.title}.</span> <span className="text-subtle">{d.detail}</span>
            </li>
          ))}
        </ul>
      </details>

      <Button variant="primary" size="md" className="self-start" disabled={!valid || busy} onClick={review}>
        {busy ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : <Rocket aria-hidden className="size-3.5" />}
        Review campaign
      </Button>
    </div>
  );
}

export default function CreateCampaignSheet() {
  const open = useAdsUi((s) => s.sheet === "createCampaign");
  const openSheet = useAdsUi((s) => s.openSheet);
  return (
    <DetailSheet open={open} onOpenChange={(o) => !o && openSheet(null)} width="sm:max-w-[680px]" title="New campaign" description="Search Results campaign with one ad group. Nothing is sent until you confirm the diff.">
      <CreateCampaignForm onDone={() => openSheet(null)} />
    </DetailSheet>
  );
}
