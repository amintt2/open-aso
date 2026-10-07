"use client";

import { useState } from "react";
import Button from "@/components/_ui/button";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import { Checkbox } from "@/components/_ui/checkbox";
import { cn } from "@/lib/utils";
import type { MatchType } from "@/lib/apple-ads/types";
import { DetailSheet } from "./bits";
import { useRequestChange } from "./change-provider";
import { parseTerms } from "./format";
import { useAdsUi } from "./store";

function MatchPicker({ value, onChange }: { value: MatchType; onChange: (m: MatchType) => void }) {
  return (
    <div role="radiogroup" aria-label="Match type" className="flex gap-1.5">
      {(["EXACT", "BROAD"] as const).map((m) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={value === m}
          onClick={() => onChange(m)}
          className={cn("caption-style border-border text-subtle hover:text-foreground h-7 cursor-pointer rounded-full border px-3 transition-colors", value === m && "bg-muted text-foreground border-line-strong")}
        >
          {m === "EXACT" ? "Exact" : "Broad"}
        </button>
      ))}
    </div>
  );
}

function TermsArea({ id, value, onChange, placeholder }: { id: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <textarea
      id={id}
      rows={6}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="bg-secondary border-line-strong focus-visible:border-ring placeholder:text-subtle w-full rounded-lg border p-3 text-[14px] outline-none"
    />
  );
}

function AddKeywordsForm({ campaignId, adGroupId, onDone }: { campaignId: string; adGroupId: string; onDone: () => void }) {
  const request = useRequestChange();
  const [text, setText] = useState("");
  const [match, setMatch] = useState<MatchType>("EXACT");
  const [bid, setBid] = useState("");
  const terms = parseTerms(text);
  const bidN = bid.trim() ? Number(bid) : null;
  const valid = terms.length > 0 && (bidN === null || bidN > 0);
  return (
    <div className="flex flex-col gap-5 p-6">
      <Field label="Keywords" htmlFor="ak-terms" hint={`${terms.length} keyword${terms.length === 1 ? "" : "s"} · comma or new line separated`}>
        <TermsArea id="ak-terms" value={text} onChange={setText} placeholder={"habit tracker\ndaily routine"} />
      </Field>
      <div className="flex flex-col gap-2">
        <span className="caption-style text-soft">Match type</span>
        <MatchPicker value={match} onChange={setMatch} />
        {match === "BROAD" && <p className="caption-style text-warning">Broad keywords belong in a discovery ad group. Keep exact groups exact.</p>}
      </div>
      <Field label="Max CPT bid" htmlFor="ak-bid" hint="Leave empty to use the ad group default bid.">
        <Input id="ak-bid" inputMode="decimal" value={bid} onChange={(e) => setBid(e.target.value)} placeholder="Ad group default" />
      </Field>
      <Button
        variant="primary"
        size="md"
        className="self-start"
        disabled={!valid}
        onClick={() =>
          request({
            title: "Add keywords",
            url: `/api/apple-ads/campaigns/${campaignId}/adgroups/${adGroupId}/keywords`,
            method: "POST",
            body: { keywords: terms.map((t) => ({ text: t, matchType: match, bid: bidN })) },
            success: "Keywords added",
            onDone,
          })
        }
      >
        Review {terms.length || ""} keyword{terms.length === 1 ? "" : "s"}
      </Button>
    </div>
  );
}

function AddNegativesForm({ campaignId, adGroupId, onDone }: { campaignId: string; adGroupId: string | null; onDone: () => void }) {
  const request = useRequestChange();
  const [text, setText] = useState("");
  const [match, setMatch] = useState<MatchType>("EXACT");
  const terms = parseTerms(text);
  const url = adGroupId ? `/api/apple-ads/campaigns/${campaignId}/adgroups/${adGroupId}/negatives` : `/api/apple-ads/campaigns/${campaignId}/negatives`;
  return (
    <div className="flex flex-col gap-5 p-6">
      <p className="text-soft">
        {adGroupId ? "Ad group negatives block these queries in this ad group only." : "Campaign negatives block these queries in every ad group of the campaign."} Exact negatives are the safe default.
      </p>
      <Field label="Negative keywords" htmlFor="an-terms" hint={`${terms.length} term${terms.length === 1 ? "" : "s"} · comma or new line separated`}>
        <TermsArea id="an-terms" value={text} onChange={setText} placeholder={"free, cheap\njobs"} />
      </Field>
      <div className="flex flex-col gap-2">
        <span className="caption-style text-soft">Match type</span>
        <MatchPicker value={match} onChange={setMatch} />
        {match === "BROAD" && <p className="caption-style text-warning">A broad negative blocks every query containing these words.</p>}
      </div>
      <Button
        variant="primary"
        size="md"
        className="self-start"
        disabled={!terms.length}
        onClick={() => request({ title: "Add negative keywords", url, method: "POST", body: { keywords: terms.map((t) => ({ text: t, matchType: match })) }, success: "Negatives added", onDone })}
      >
        Review {terms.length || ""} negative{terms.length === 1 ? "" : "s"}
      </Button>
    </div>
  );
}

function CreateAdGroupForm({ campaignId, onDone }: { campaignId: string; onDone: () => void }) {
  const request = useRequestChange();
  const [name, setName] = useState("");
  const [bid, setBid] = useState("1.00");
  const [match, setMatch] = useState<MatchType>("EXACT");
  const [searchMatch, setSearchMatch] = useState(false);
  const [text, setText] = useState("");
  const terms = parseTerms(text);
  const bidN = Number(bid);
  const valid = name.trim().length > 0 && bidN > 0;
  return (
    <div className="flex flex-col gap-5 p-6">
      <Field label="Name" htmlFor="ag-name" hint="Unique within the campaign, e.g. App_US_Exact_SR_Generic">
        <Input id="ag-name" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Default max CPT bid" htmlFor="ag-bid">
        <Input id="ag-bid" inputMode="decimal" value={bid} onChange={(e) => setBid(e.target.value)} />
      </Field>
      <div className="flex flex-col gap-2">
        <span className="caption-style text-soft">Keyword match type</span>
        <MatchPicker value={match} onChange={setMatch} />
      </div>
      <label className="flex cursor-pointer items-start gap-2.5">
        <Checkbox checked={searchMatch} onCheckedChange={(v) => setSearchMatch(v === true)} className="mt-px" />
        <span className="flex flex-col gap-1.5">
          <span className="text-[13px]">Search Match</span>
          <span className="caption-style text-subtle">Off by default. Turn it on only for a dedicated discovery group.</span>
        </span>
      </label>
      <Field label="Keywords (optional)" htmlFor="ag-terms" hint={`${terms.length} keyword${terms.length === 1 ? "" : "s"} at the default bid`}>
        <TermsArea id="ag-terms" value={text} onChange={setText} placeholder="habit tracker, routine planner" />
      </Field>
      <Button
        variant="primary"
        size="md"
        className="self-start"
        disabled={!valid}
        onClick={() =>
          request({
            title: "Create ad group",
            url: `/api/apple-ads/campaigns/${campaignId}/adgroups`,
            method: "POST",
            body: { name: name.trim(), defaultBid: bidN, searchMatch, matchType: match, keywords: terms.map((t) => ({ text: t })) },
            success: "Ad group created",
            onDone,
          })
        }
      >
        Review ad group
      </Button>
    </div>
  );
}

export function AddKeywordsSheet() {
  const ref = useAdsUi((s) => s.addKeywordsTo);
  const close = useAdsUi((s) => s.openAddKeywords);
  return (
    <DetailSheet open={ref !== null} onOpenChange={(o) => !o && close(null)} width="sm:max-w-[520px]" title="Add keywords">
      {ref && <AddKeywordsForm campaignId={ref.campaignId} adGroupId={ref.adGroupId} onDone={() => close(null)} />}
    </DetailSheet>
  );
}

export function AddNegativesSheet() {
  const ref = useAdsUi((s) => s.addNegativesTo);
  const close = useAdsUi((s) => s.openAddNegatives);
  return (
    <DetailSheet open={ref !== null} onOpenChange={(o) => !o && close(null)} width="sm:max-w-[520px]" title={ref?.adGroupId ? "Add ad group negatives" : "Add campaign negatives"}>
      {ref && <AddNegativesForm campaignId={ref.campaignId} adGroupId={ref.adGroupId} onDone={() => close(null)} />}
    </DetailSheet>
  );
}

export function CreateAdGroupSheet() {
  const campaignId = useAdsUi((s) => s.createAdGroupFor);
  const close = useAdsUi((s) => s.openCreateAdGroup);
  return (
    <DetailSheet open={campaignId !== null} onOpenChange={(o) => !o && close(null)} width="sm:max-w-[520px]" title="New ad group">
      {campaignId && <CreateAdGroupForm campaignId={campaignId} onDone={() => close(null)} />}
    </DetailSheet>
  );
}
