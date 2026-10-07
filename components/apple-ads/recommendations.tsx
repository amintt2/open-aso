"use client";

import { useState } from "react";
import { BookOpen, Sparkles } from "lucide-react";
import { toast } from "sonner";
import Button from "@/components/_ui/button";
import { Input } from "@/components/_ui/input";
import { Checkbox } from "@/components/_ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/_ui/tabs";
import { api, revalidate } from "@/lib/client/api";
import { REVIEW_CHECKLIST } from "@/lib/apple-ads/knowledge";
import type { AdsDashboard, BidSuggestion } from "@/lib/apple-ads/types";
import { cn } from "@/lib/utils";
import { useRequestChange } from "./change-provider";
import { money, signedPct } from "./format";
import { useAdsUi } from "./store";

function TargetCpa({ value, currency, demo }: { value: number | null; currency: string; demo: boolean }) {
  const [draft, setDraft] = useState<string | null>(null);
  async function save() {
    const raw = draft?.trim() ?? "";
    setDraft(null);
    const n = raw ? Number(raw) : null;
    if (n !== null && !(n > 0)) return toast.error("Target CPA must be a positive number");
    try {
      await api("/api/apple-ads/settings", { method: "PUT", body: { targetCpa: n } });
      await revalidate("/api/apple-ads/");
      toast.success(n ? `Target CPA set to ${money(n, currency)}` : "Target CPA cleared");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    }
  }
  return (
    <label className="caption-style text-subtle flex items-center gap-2">
      Target CPA
      <Input
        value={draft ?? (value != null ? String(value) : "")}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft !== null && save()}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        placeholder={demo ? "4.00" : "none"}
        inputMode="decimal"
        className="h-7 w-20 px-2 text-[13px]"
      />
    </label>
  );
}

function BidList({ list, currency }: { list: BidSuggestion[]; currency: string }) {
  const request = useRequestChange();
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const chosen = list.filter((s) => !excluded.has(s.keywordId));
  if (!list.length) return <p className="text-subtle py-6 text-center">No bid changes recommended. Keywords are on target or still learning.</p>;
  return (
    <div className="flex flex-col gap-3">
      <ul className="divide-border flex flex-col divide-y">
        {list.map((s) => (
          <li key={s.keywordId} className="flex items-start gap-3 py-2.5">
            <Checkbox
              aria-label={`Include ${s.text}`}
              checked={!excluded.has(s.keywordId)}
              onCheckedChange={(v) => {
                const next = new Set(excluded);
                if (v === true) next.delete(s.keywordId);
                else next.add(s.keywordId);
                setExcluded(next);
              }}
              className="mt-0.5"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-[13px]">{s.text}</span>
                <span className="flex shrink-0 items-center gap-2 text-[13px] tabular-nums">
                  <span className="text-subtle">{money(s.current, currency)}</span>→<span>{money(s.suggested, currency)}</span>
                  <span className={cn("caption-style w-10 text-right", s.changePct > 0 ? "text-trend" : "text-warning")}>{signedPct(s.changePct)}</span>
                </span>
              </div>
              <span className="caption-style text-subtle leading-[1.35]">{s.why}</span>
            </div>
          </li>
        ))}
      </ul>
      <Button
        variant="primary"
        size="sm"
        className="self-start"
        disabled={!chosen.length}
        onClick={() =>
          request({
            title: `Apply ${chosen.length} bid change${chosen.length === 1 ? "" : "s"}`,
            description: "Each change follows a playbook rule and is capped at ±30%.",
            url: "/api/apple-ads/bids",
            method: "POST",
            body: { changes: chosen.map((s) => ({ campaignId: s.campaignId, adGroupId: s.adGroupId, keywordId: s.keywordId, bid: s.suggested })), enforceCaps: true },
            success: "Bids updated",
          })
        }
      >
        <Sparkles aria-hidden className="size-3.5" />
        Apply {chosen.length} selected
      </Button>
    </div>
  );
}

export default function Recommendations({ data }: { data: AdsDashboard }) {
  const request = useRequestChange();
  const openSheet = useAdsUi((s) => s.openSheet);
  const bids = data.bidSuggestions;
  const budgets = data.budgetSuggestions;
  return (
    <section className="bg-card border-border flex flex-col rounded-xl border">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
        <h2>Recommendations</h2>
        <div className="flex items-center gap-2">
          <TargetCpa value={data.targetCpa} currency={data.currency} demo={data.demo} />
          <Button variant="ghost" size="sm" onClick={() => openSheet("playbook")}>
            <BookOpen aria-hidden className="size-3.5" />
            Playbook
          </Button>
        </div>
      </div>
      <Tabs defaultValue="bids" className="px-4">
        <TabsList className="border-border border-b">
          <TabsTrigger value="bids">Bids ({bids.length})</TabsTrigger>
          <TabsTrigger value="budgets">Budgets ({budgets.length})</TabsTrigger>
          <TabsTrigger value="checklist">Checklist</TabsTrigger>
        </TabsList>
        <TabsContent value="bids" className="max-h-[460px] overflow-y-auto py-3">
          <BidList key={bids.map((b) => b.keywordId + b.suggested).join()} list={bids} currency={data.currency} />
        </TabsContent>
        <TabsContent value="budgets" className="py-3">
          {budgets.length ? (
            <ul className="divide-border flex flex-col divide-y">
              {budgets.map((b) => (
                <li key={b.campaignId} className="flex items-start gap-3 py-2.5">
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-[13px]">{b.name}</span>
                      <span className="flex shrink-0 items-center gap-2 text-[13px] tabular-nums">
                        <span className="text-subtle">{money(b.current, data.currency, 0)}</span>→<span>{money(b.suggested, data.currency, 0)}</span>
                        <span className={cn("caption-style", b.changePct > 0 ? "text-trend" : "text-warning")}>{signedPct(b.changePct)}</span>
                      </span>
                    </div>
                    <span className="caption-style text-subtle leading-[1.35]">{b.why}</span>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      request({ title: "Change daily budget", url: "/api/apple-ads/budgets", method: "POST", body: { changes: [{ campaignId: b.campaignId, dailyBudget: b.suggested }], enforceCaps: true }, success: "Budget updated" })
                    }
                  >
                    Apply
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-subtle py-6 text-center">No budget changes recommended.</p>
          )}
        </TabsContent>
        <TabsContent value="checklist" className="flex flex-col gap-4 py-3">
          {REVIEW_CHECKLIST.map((c) => (
            <div key={c.cadence} className="flex flex-col gap-2">
              <span className="eyebrow-style text-subtle">{c.cadence}</span>
              <ul className="flex list-disc flex-col gap-1.5 pl-4">
                {c.items.map((item) => (
                  <li key={item} className="text-soft text-[13px] leading-[1.35]">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </section>
  );
}
