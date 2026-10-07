"use client";

import { BID_RULES, FORMULAS, GUARDRAILS, REVIEW_CHECKLIST, SAFE_DEFAULTS } from "@/lib/apple-ads/knowledge";
import { DetailSheet } from "./bits";
import { useAdsUi } from "./store";

export default function PlaybookSheet() {
  const open = useAdsUi((s) => s.sheet === "playbook");
  const openSheet = useAdsUi((s) => s.openSheet);
  return (
    <DetailSheet open={open} onOpenChange={(o) => !o && openSheet(null)} width="sm:max-w-[720px]" title="Apple Ads playbook" description="The rules behind every diagnosis and suggested change">
      <div className="flex flex-col gap-8 p-6">
        <section className="flex flex-col gap-3">
          <h3>Formulas</h3>
          <dl className="border-border divide-border divide-y rounded-xl border">
            {FORMULAS.map((f) => (
              <div key={f.name} className="grid gap-1.5 px-3 py-2.5 sm:grid-cols-[150px_1fr]">
                <dt className="flex flex-col gap-1">
                  <span className="text-[13px]">{f.name}</span>
                  <span className="caption-style text-subtle font-mono">{f.formula}</span>
                </dt>
                <dd className="text-soft text-[13px] leading-[1.35]">{f.meaning}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="flex flex-col gap-3">
          <h3>Safe defaults</h3>
          <ul className="flex flex-col gap-2.5">
            {SAFE_DEFAULTS.map((d) => (
              <li key={d.title} className="text-[13px] leading-[1.35]">
                <span className="text-foreground">{d.title}.</span> <span className="text-soft">{d.detail}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="flex flex-col gap-3">
          <h3>Bid rules</h3>
          <ul className="border-border divide-border divide-y rounded-xl border">
            {BID_RULES.map((r) => (
              <li key={r.rule} className="flex flex-col gap-1.5 px-3 py-2.5">
                <span className="caption-style text-subtle font-mono">{r.rule}</span>
                <span className="text-[13px]">{r.when}</span>
                <span className="text-soft text-[13px] leading-[1.35]">{r.then}</span>
              </li>
            ))}
          </ul>
          <p className="caption-style text-subtle leading-[1.4]">
            Guardrails: no single bid change beyond ±{GUARDRAILS.maxBidChange * 100}%, no budget increase beyond +{GUARDRAILS.maxBudgetIncrease * 100}% per step, decisions only after {GUARDRAILS.minTapsForDecision}+ taps. Every write is previewed as a diff and needs confirmation.
          </p>
        </section>
        <section className="flex flex-col gap-3">
          <h3>Review cadence</h3>
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
        </section>
      </div>
    </DetailSheet>
  );
}
