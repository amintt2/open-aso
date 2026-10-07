"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, CircleDashed, CircleDot, Globe, KeyRound, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import Button from "@/components/_ui/button";
import Tag from "@/components/_ui/tag";
import { api, revalidate, useApi } from "@/lib/client/api";
import { timeAgo } from "@/lib/client/format";
import type { IntegrationEvent, IntegrationProvider } from "@/lib/integrations/log";
import { cn } from "@/lib/utils";
import CopyField from "./copy-field";

export type CardState = "connected" | "waiting" | "error" | "off" | "loading";

const STATE_META: Record<CardState, { label: string; tone: "green" | "amber" | "red" | "neutral" }> = {
  connected: { label: "Connected", tone: "green" },
  waiting: { label: "Waiting for events", tone: "amber" },
  error: { label: "Needs attention", tone: "red" },
  off: { label: "Not connected", tone: "neutral" },
  loading: { label: "Checking…", tone: "neutral" },
};

export function StatusTag({ state, label }: { state: CardState; label?: string }) {
  const meta = STATE_META[state];
  return (
    <Tag tone={meta.tone} size="sm" className="gap-1.5 text-[12px]">
      <span aria-hidden className={cn("size-1.5 rounded-full bg-current", state === "loading" && "animate-pulse")} />
      {label ?? meta.label}
    </Tag>
  );
}

const noopSubscribe = () => () => {};

export function useOrigin() {
  return useSyncExternalStore(noopSubscribe, () => window.location.origin, () => "");
}

export function isLocalOrigin(origin: string) {
  try {
    const host = new URL(origin).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host.endsWith(".local") || host.endsWith(".localhost");
  } catch {
    return false;
  }
}

export function LocalhostNotice({ origin, who }: { origin: string; who: string }) {
  if (!origin || !isLocalOrigin(origin)) return null;
  return (
    <div className="flex gap-2 rounded-lg border border-(--tag-amber-border) bg-(--tag-amber-bg) px-3 py-2.5 text-(--tag-amber-text)">
      <Globe aria-hidden className="mt-0.5 size-4 shrink-0" />
      <p className="caption-style leading-[1.4]">
        {who} can&apos;t reach {new URL(origin).host}. Expose Open ASO on a public HTTPS URL (deploy it, or run a tunnel such as cloudflared or ngrok) and use that address instead. The webhook and ingest endpoints stay reachable when password protection is on.
      </p>
    </div>
  );
}

export function Step({ n, title, children }: { n: number; title: string; children?: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="bg-muted text-soft caption-style flex size-6 shrink-0 items-center justify-center rounded-full tabular-nums">{n}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-3 pt-1">
        <span className="lead-style">{title}</span>
        {children}
      </div>
    </li>
  );
}

export function Section({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-3", className)}>
      <h3 className="eyebrow-style text-subtle">{title}</h3>
      {children}
    </section>
  );
}

export function TokenManager({
  kind,
  hint,
  label,
  onToken,
  token,
}: {
  kind: "revenuecat" | "sdk";
  hint: string | null;
  label: string;
  token: string | null;
  onToken: (token: string | null) => void;
}) {
  const [busy, setBusy] = useState<"rotate" | "revoke" | null>(null);
  async function run(action: "rotate" | "revoke") {
    if (action === "rotate" && hint && !window.confirm(`Rotate the ${label}? Anything using the current token stops working until you update it.`)) return;
    if (action === "revoke" && !window.confirm(`Revoke the ${label}? Requests using it will be rejected.`)) return;
    setBusy(action);
    try {
      const res = await api<{ token: string | null }>("/api/integrations/tokens", { method: "POST", body: { kind, action } });
      onToken(res.token);
      await revalidate("/api/integrations");
      toast.success(action === "rotate" ? `${label} generated` : `${label} revoked`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="flex flex-col gap-3">
      {token ? (
        <>
          <CopyField label={label} value={token} secret />
          <p className="caption-style text-warning">Copy it now. For your security it won&apos;t be shown again.</p>
        </>
      ) : (
        <div className="bg-secondary border-line-strong flex h-9 items-center gap-2 rounded-lg border px-3">
          <KeyRound aria-hidden className="text-subtle size-3.5" />
          <span className={cn("font-mono text-[13px]", !hint && "text-subtle")}>{hint ?? "No token yet"}</span>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant={hint ? "secondary" : "primary"} size="sm" onClick={() => run("rotate")} disabled={!!busy}>
          <RefreshCw aria-hidden className={cn("size-3.5", busy === "rotate" && "animate-spin")} />
          {hint ? "Rotate token" : "Generate token"}
        </Button>
        {hint && (
          <Button variant="ghost" size="sm" onClick={() => run("revoke")} disabled={!!busy}>
            <Trash2 aria-hidden className="size-3.5" />
            Revoke
          </Button>
        )}
      </div>
    </div>
  );
}

const EVENT_ICON = {
  ok: <CheckCircle2 aria-hidden className="text-trend size-3.5 shrink-0" />,
  duplicate: <CircleDot aria-hidden className="text-subtle size-3.5 shrink-0" />,
  ignored: <CircleDashed aria-hidden className="text-subtle size-3.5 shrink-0" />,
  error: <AlertTriangle aria-hidden className="text-danger size-3.5 shrink-0" />,
};

export function EventLog({ provider }: { provider: IntegrationProvider }) {
  const { data } = useApi<IntegrationEvent[]>(`/api/integrations/events?provider=${provider}&limit=20`, { refreshInterval: 5000 });
  if (!data) return <p className="caption-style text-subtle">Loading…</p>;
  if (!data.length) return <p className="caption-style text-subtle">Nothing received yet. This list refreshes automatically.</p>;
  return (
    <ul className="border-line-strong divide-line-strong divide-y overflow-hidden rounded-lg border">
      {data.map((e) => (
        <li key={e.id} className="flex items-center gap-2.5 px-3 py-2.5">
          {EVENT_ICON[e.status]}
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="caption-style text-foreground truncate">{e.message ?? e.eventType ?? e.status}</span>
            <span className="caption-style text-subtle">
              {[e.eventType, e.environment, e.status === "duplicate" ? "duplicate, ignored" : null].filter(Boolean).join(" · ")}
            </span>
          </span>
          <span className="caption-style text-subtle shrink-0" title={e.receivedAt}>
            {timeAgo(e.receivedAt)}
          </span>
        </li>
      ))}
    </ul>
  );
}
