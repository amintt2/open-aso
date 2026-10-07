"use client";

import { KeyRound, Lock, LockOpen, RefreshCw, ShieldAlert, Trash2 } from "lucide-react";
import Button from "@/components/_ui/button";
import Tag from "@/components/_ui/tag";
import SettingsCard from "@/components/settings/settings-card";
import CopyField from "@/components/integrations/copy-field";

export default function AccessCard({
  tokenSet,
  passwordProtected,
  revealed,
  busy,
  onRotate,
  onClear,
}: {
  tokenSet: boolean;
  passwordProtected: boolean;
  revealed: string | null;
  busy: boolean;
  onRotate: () => void;
  onClear: () => void;
}) {
  const blocked = !tokenSet && passwordProtected;
  return (
    <SettingsCard
      id="access"
      title="Access token"
      description={
        tokenSet
          ? "Every request must send Authorization: Bearer <token>. Rotate it if it leaks; clients using the old token stop working immediately."
          : passwordProtected
            ? "Password protection is on, so MCP clients need a token. Generate one to connect."
            : "Without a token only clients on this machine (localhost) can connect. Generate a token to allow remote clients or to lock down local ones."
      }
      aside={
        <Tag tone={tokenSet ? "green" : blocked ? "red" : "amber"} size="sm" className="gap-1.5 text-[12px]">
          {tokenSet ? <Lock aria-hidden className="size-3" /> : blocked ? <ShieldAlert aria-hidden className="size-3" /> : <LockOpen aria-hidden className="size-3" />}
          {tokenSet ? "Token required" : blocked ? "No access" : "Localhost only"}
        </Tag>
      }
    >
      {revealed && (
        <div className="flex flex-col gap-2">
          <CopyField label="New token" value={revealed} secret />
          <p className="caption-style text-(--tag-amber-text)">Copy it now. It is stored on this machine and will not be shown again; the setup snippets below include it until you leave this page.</p>
        </div>
      )}
      {tokenSet && !revealed && (
        <div className="flex flex-col gap-2">
          <span className="caption-style text-soft">Current token</span>
          <code className="border-line-strong bg-secondary text-subtle flex h-9 items-center rounded-lg border px-3 font-mono text-[13px]" aria-label="Token hidden">
            oaso_••••••••••••••••••••••••••••••••
          </code>
          <span className="caption-style text-subtle">Stored on this machine and never shown again. Rotate it to get a new one.</span>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant={tokenSet ? "secondary" : "primary"} size="md" disabled={busy} onClick={onRotate}>
          {tokenSet ? <RefreshCw aria-hidden className="size-3.5" /> : <KeyRound aria-hidden className="size-3.5" />}
          {tokenSet ? "Rotate token" : "Generate token"}
        </Button>
        {tokenSet && (
          <Button variant="ghost" size="md" disabled={busy} onClick={onClear}>
            <Trash2 aria-hidden className="size-3.5" />
            Remove token
          </Button>
        )}
      </div>
    </SettingsCard>
  );
}
