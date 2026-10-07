"use client";

import { Lock, LockOpen, Timer, TimerOff } from "lucide-react";
import Tag from "@/components/_ui/tag";
import { formatCompact, timeAgo } from "@/lib/client/format";
import { CodeBlock } from "@/components/integrations/copy-field";
import SettingsCard, { KeyValue } from "./settings-card";

export type SystemInfo = {
  database: { directory: string; file: string; sizeBytes: number; tables: { name: string; rows: number }[] };
  scheduler: { disabled: boolean; keywords: number; staleKeywords: number; lastRefreshedAt: string | null };
  passwordProtection: { enabled: boolean; username: string | null };
};

export function SchedulerSettings({ info }: { info: SystemInfo | undefined }) {
  const s = info?.scheduler;
  return (
    <SettingsCard
      id="scheduler"
      title="Keyword refresh"
      description="A background job checks every 30 minutes and refreshes tracked keywords that haven't been updated in the last 20 hours, so rankings and popularity history build up daily while Open ASO is running."
      aside={
        s && (
          <Tag tone={s.disabled ? "neutral" : "green"} size="sm" className="gap-1.5 text-[12px]">
            {s.disabled ? <TimerOff aria-hidden className="size-3" /> : <Timer aria-hidden className="size-3" />}
            {s.disabled ? "Disabled" : "Running"}
          </Tag>
        )
      }
    >
      <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
        <KeyValue label="Tracked keywords" value={s ? formatCompact(s.keywords) : "—"} />
        <KeyValue label="Due for refresh" value={s ? formatCompact(s.staleKeywords) : "—"} />
        <KeyValue label="Last refresh" value={s ? timeAgo(s.lastRefreshedAt) : "—"} />
        <KeyValue label="Status" value={s ? (s.disabled ? "Disabled by environment" : "Enabled") : "—"} />
      </div>
      <p className="caption-style text-subtle">Set OPEN_ASO_DISABLE_SCHEDULER=1 before starting the server to turn it off (for example when several instances share one database). Keywords can still be refreshed manually.</p>
    </SettingsCard>
  );
}

export function AccessSettings({ info }: { info: SystemInfo | undefined }) {
  const p = info?.passwordProtection;
  return (
    <SettingsCard
      id="access"
      title="Access protection"
      description="Open ASO has no accounts. When you expose it beyond localhost, protect it with a password: every page and API route then requires HTTP Basic authentication."
      aside={
        p && (
          <Tag tone={p.enabled ? "green" : "amber"} size="sm" className="gap-1.5 text-[12px]">
            {p.enabled ? <Lock aria-hidden className="size-3" /> : <LockOpen aria-hidden className="size-3" />}
            {p.enabled ? "Password required" : "Open"}
          </Tag>
        )
      }
    >
      <CodeBlock title=".env.local" language="env" code={`OPEN_ASO_PASSWORD=choose-a-long-random-password\nOPEN_ASO_USERNAME=admin`} />
      <div className="flex flex-col gap-2">
        <p className="text-soft">Restart the server after changing it. The username is optional; without it any username is accepted. These endpoints stay public because they verify their own credentials:</p>
        <ul className="caption-style text-soft flex flex-col gap-1.5 pl-4">
          <li className="list-disc">
            <code className="font-mono">/api/integrations/revenuecat</code> — Authorization header token
          </li>
          <li className="list-disc">
            <code className="font-mono">/api/integrations/superwall</code> — Svix signature with your signing secret
          </li>
          <li className="list-disc">
            <code className="font-mono">/api/attribution/*</code> — SDK bearer token
          </li>
        </ul>
      </div>
    </SettingsCard>
  );
}
