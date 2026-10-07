"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, CircleAlert, Info, Lightbulb, type LucideIcon } from "lucide-react";
import Button from "@/components/_ui/button";
import Tag from "@/components/_ui/tag";
import { useApi } from "@/lib/client/api";
import type { TrackedApp } from "@/lib/client/types";
import type { InsightSeverity, MetadataInsights } from "@/lib/insights/types";
import { cn } from "@/lib/utils";
import SubtitleField from "./subtitle-field";

const SEVERITY: Record<InsightSeverity, { icon: LucideIcon; className: string; label: string }> = {
  high: { icon: AlertTriangle, className: "text-danger", label: "High impact" },
  medium: { icon: CircleAlert, className: "text-warning", label: "Worth doing" },
  low: { icon: Info, className: "text-soft", label: "Note" },
  positive: { icon: CheckCircle2, className: "text-trend", label: "Working well" },
};

const PREVIEW = 4;

function CharMeter({ used, limit }: { used: number; limit: number }) {
  const over = used > limit;
  return (
    <span className="flex items-center gap-2">
      <span className="bg-track h-1.5 w-16 overflow-hidden rounded-full" aria-hidden>
        <span className={cn("block h-full rounded-full", over ? "bg-danger" : used === limit ? "bg-success" : used >= limit - 6 ? "bg-warning" : "bg-subtle")} style={{ width: `${Math.min(100, (used / limit) * 100)}%` }} />
      </span>
      <span className={cn("caption-style tabular-nums", over ? "text-danger" : "text-subtle")}>
        {used}/{limit}
      </span>
    </span>
  );
}

export default function InsightsPanel({ app, country }: { app: TrackedApp; country: string }) {
  const url = `/api/insights/metadata?appId=${app.id}&country=${country}`;
  const { data, mutate, isLoading } = useApi<MetadataInsights>(url);
  const [expanded, setExpanded] = useState(false);
  const insights = data?.insights ?? [];
  const visible = expanded ? insights : insights.slice(0, PREVIEW);

  return (
    <section aria-labelledby="insights-heading" className="bg-card border-border flex flex-col rounded-xl border">
      <div className="border-border flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <h2 id="insights-heading" className="flex items-center gap-2">
          <Lightbulb aria-hidden className="text-soft size-4" strokeWidth={1.75} />
          Metadata insights
        </h2>
        {data && (
          <span className="caption-style text-subtle">
            Based on {data.keywordsAnalyzed} analyzed {data.keywordsAnalyzed === 1 ? "keyword" : "keywords"}
          </span>
        )}
      </div>

      <div className="border-border grid gap-4 border-b px-4 py-4 md:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="eyebrow-style text-subtle">Title</span>
            {data && <CharMeter used={data.titleLength} limit={data.limit} />}
          </div>
          <p className="bg-secondary border-line-strong flex h-9 items-center truncate rounded-lg border px-3">{data?.title ?? app.store.trackName ?? app.name}</p>
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="subtitle-input" className="eyebrow-style text-subtle">
              Subtitle
            </label>
            {data && <CharMeter used={data.subtitleLength} limit={data.limit} />}
          </div>
          <SubtitleField app={app} onSaved={() => mutate()} />
        </div>
      </div>

      {isLoading && !data ? (
        <p className="text-subtle px-4 py-5">Reviewing your metadata…</p>
      ) : (
        <ul className="divide-border flex flex-col divide-y">
          {visible.map((insight) => {
            const s = SEVERITY[insight.severity];
            return (
              <li key={insight.id} className="flex items-start gap-3 px-4 py-3">
                <s.icon aria-label={s.label} className={cn("mt-px size-4 shrink-0", s.className)} strokeWidth={1.75} />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="text-[14px] leading-tight">{insight.title}</span>
                  <p className="caption-style text-subtle leading-snug">{insight.detail}</p>
                </div>
                {insight.keyword && (
                  <Tag tone="neutral" size="sm" className="hidden max-w-[180px] truncate text-[12px] sm:inline-flex">
                    {insight.keyword}
                  </Tag>
                )}
              </li>
            );
          })}
          {!visible.length && <li className="text-subtle px-4 py-5">Nothing to flag. Track and refresh more keywords for deeper insights.</li>}
        </ul>
      )}

      {insights.length > PREVIEW && (
        <div className="border-border border-t px-4 py-2">
          <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
            <ChevronDown aria-hidden className={cn("size-3.5 transition-transform duration-200", expanded && "rotate-180")} />
            {expanded ? "Show fewer" : `Show all ${insights.length} insights`}
          </Button>
        </div>
      )}
    </section>
  );
}
