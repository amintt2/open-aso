"use client";

import { useState } from "react";
import { AlertTriangle, ArrowRight, Wrench } from "lucide-react";
import Button from "@/components/_ui/button";
import { Checkbox } from "@/components/_ui/checkbox";
import type { CannibalizationIssue } from "@/lib/apple-ads/types";
import { DetailSheet } from "./bits";
import { useRequestChange } from "./change-provider";
import { countryLabel } from "./format";
import { useAdsUi } from "./store";

export function CannibalizationBanner({ issues }: { issues: CannibalizationIssue[] }) {
  const openSheet = useAdsUi((s) => s.openSheet);
  if (!issues.length) return null;
  const terms = new Set(issues.map((i) => i.term)).size;
  return (
    <div role="status" className="border-(--tag-amber-border) bg-(--tag-amber-bg) flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3">
      <AlertTriangle aria-hidden className="text-(--tag-amber-text) size-4 shrink-0" />
      <p className="text-(--tag-amber-text) min-w-0 flex-1 text-[13px]">
        {terms} exact keyword{terms === 1 ? "" : "s"} can also be served by broad or Search Match ad groups of the same app and country, so your own groups compete in the same auction.
      </p>
      <Button variant="secondary" size="sm" onClick={() => openSheet("cannibalization")}>
        <Wrench aria-hidden className="size-3.5" />
        Fix
      </Button>
    </div>
  );
}

function FixForm({ issues, onDone }: { issues: CannibalizationIssue[]; onDone: () => void }) {
  const request = useRequestChange();
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const chosen = issues.filter((i) => !excluded.has(i.id));
  return (
    <div className="flex flex-col gap-5 p-6">
      <p className="text-soft">Each selected term is added as a negative exact keyword to the discovery ad group, so only the exact group can win that query.</p>
      <ul className="border-border divide-border divide-y rounded-xl border">
        {issues.map((i) => (
          <li key={i.id} className="flex items-start gap-3 px-3 py-3">
            <Checkbox
              aria-label={`Fix ${i.term} in ${i.target.adGroupName}`}
              checked={!excluded.has(i.id)}
              onCheckedChange={(v) => {
                const next = new Set(excluded);
                if (v === true) next.delete(i.id);
                else next.add(i.id);
                setExcluded(next);
              }}
              className="mt-0.5"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="text-[13px]">
                “{i.term}” <span className="text-subtle">· {countryLabel(i.country)}</span>
              </span>
              <span className="caption-style text-subtle flex flex-wrap items-center gap-1.5">
                <span className="truncate">{i.exact.adGroupName}</span>
                <ArrowRight aria-hidden className="size-3" />
                <span className="text-soft truncate">negative exact in {i.target.adGroupName}</span>
              </span>
              <span className="caption-style text-subtle">{i.target.reason}</span>
            </div>
          </li>
        ))}
      </ul>
      <Button
        variant="primary"
        size="md"
        className="self-start"
        disabled={!chosen.length}
        onClick={() =>
          request({
            title: "Add negatives to stop cannibalization",
            url: "/api/apple-ads/cannibalization",
            method: "POST",
            body: { issueIds: chosen.map((i) => i.id) },
            success: "Negatives added",
            onDone,
          })
        }
      >
        Review {chosen.length} fix{chosen.length === 1 ? "" : "es"}
      </Button>
    </div>
  );
}

export function CannibalizationSheet({ issues }: { issues: CannibalizationIssue[] }) {
  const open = useAdsUi((s) => s.sheet === "cannibalization");
  const openSheet = useAdsUi((s) => s.openSheet);
  return (
    <DetailSheet open={open} onOpenChange={(o) => !o && openSheet(null)} width="sm:max-w-[640px]" title="Fix keyword cannibalization" description={`${issues.length} overlap${issues.length === 1 ? "" : "s"} between exact and discovery ad groups`}>
      {issues.length ? <FixForm issues={issues} onDone={() => openSheet(null)} /> : <p className="text-subtle p-6">No overlaps left.</p>}
    </DetailSheet>
  );
}
