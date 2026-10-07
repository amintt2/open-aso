"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import Button from "@/components/_ui/button";
import { api } from "@/lib/client/api";
import { timeAgo } from "@/lib/client/format";
import type { ReviewSummary, SummaryPoint } from "@/lib/reviews/types";
import { cn } from "@/lib/utils";

function PointList({ title, points, tone }: { title: string; points: SummaryPoint[]; tone: "danger" | "warning" | "success" }) {
  if (!points.length) return null;
  return (
    <section className="flex flex-col gap-2">
      <h4 className="eyebrow-style text-subtle">{title}</h4>
      <ul className="flex flex-col gap-2.5">
        {points.map((p) => (
          <li key={p.title} className="flex gap-2.5">
            <span aria-hidden className={cn("mt-1 size-1.5 shrink-0 rounded-full", tone === "danger" ? "bg-danger" : tone === "warning" ? "bg-warning" : "bg-success")} />
            <div className="flex min-w-0 flex-col gap-1">
              <span className="lead-style font-medium">
                {p.title}
                {p.mentions != null && <span className="caption-style text-subtle font-normal"> · ~{p.mentions} reviews</span>}
              </span>
              {p.detail && <p className="caption-style text-soft leading-[1.45]">{p.detail}</p>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function AiSummary({ trackId, scope, appName }: { trackId: number; scope: string; appName: string }) {
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      setSummary(await api<ReviewSummary>(`/api/reviews/${trackId}/summary`, { method: "POST", body: { country: scope, appName } }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not summarize reviews");
    } finally {
      setBusy(false);
    }
  }

  if (!summary)
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="caption-style text-subtle leading-[1.45]">Group recent complaints, feature requests and praise into themes with Claude.</p>
        <Button variant="secondary" size="md" disabled={busy} onClick={() => void run()}>
          {busy ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : <Sparkles aria-hidden className="size-3.5" />}
          {busy ? "Summarizing…" : "Summarize with AI"}
        </Button>
      </div>
    );

  return (
    <div className="flex flex-col gap-4" aria-live="polite">
      {summary.overview && <p className="text-soft leading-[1.5]">{summary.overview}</p>}
      <PointList title="Complaints" points={summary.complaints} tone="danger" />
      <PointList title="Feature requests" points={summary.requests} tone="warning" />
      <PointList title="Praise" points={summary.praise} tone="success" />
      <p className="caption-style text-faint">
        Based on {summary.reviewCount} reviews · {summary.model} · {timeAgo(summary.generatedAt)}
      </p>
    </div>
  );
}
