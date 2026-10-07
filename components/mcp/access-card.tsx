"use client";

import { KeyRound, Lock, LockOpen, RefreshCw, Trash2 } from "lucide-react";
import Button from "@/components/_ui/button";
import Tag from "@/components/_ui/tag";
import SettingsCard from "@/components/settings/settings-card";
import CopyField from "@/components/integrations/copy-field";
import { timeAgo } from "@/lib/client/format";

export default function AccessCard({
  tokenSet,
  hint,
  lastUsedAt,
  revealed,
  busy,
  canManage,
  onRotate,
  onClear,
}: {
  tokenSet: boolean;
  hint: string | null;
  lastUsedAt: string | null;
  revealed: string | null;
  busy: boolean;
  canManage: boolean;
  onRotate: () => void;
  onClear: () => void;
}) {
  return (
    <SettingsCard
      id="access"
      title="Access token"
      description={
        tokenSet
          ? "Every request must send Authorization: Bearer <token>. The token identifies this workspace, so tools only see its data. Rotate it if it leaks; the old token stops working immediately."
          : "MCP clients authenticate with a workspace token. Generate one to connect an assistant to this workspace."
      }
      aside={
        <Tag tone={tokenSet ? "green" : "amber"} size="sm" className="gap-1.5 text-[12px]">
          {tokenSet ? <Lock aria-hidden className="size-3" /> : <LockOpen aria-hidden className="size-3" />}
          {tokenSet ? "Token active" : "No token"}
        </Tag>
      }
    >
      {revealed && (
        <div className="flex flex-col gap-2">
          <CopyField label="New token" value={revealed} secret />
          <p className="caption-style text-(--tag-amber-text)">Copy it now. Only a hash is stored, so it can&apos;t be shown again; the setup snippets below include it until you leave this page.</p>
        </div>
      )}
      {tokenSet && !revealed && (
        <div className="flex flex-col gap-2">
          <span className="caption-style text-soft">Current token</span>
          <code className="border-line-strong bg-secondary text-subtle flex h-9 items-center rounded-lg border px-3 font-mono text-[13px]" aria-label="Token hidden">
            {hint ?? "oaso_mcp_••••••••"}
          </code>
          <span className="caption-style text-subtle">Last used {lastUsedAt ? timeAgo(lastUsedAt) : "never"}. Only a hash is stored; rotate it to get a new one.</span>
        </div>
      )}
      {canManage && (
        <div className="flex flex-wrap gap-2">
          <Button variant={tokenSet ? "secondary" : "primary"} size="md" disabled={busy} onClick={onRotate}>
            {tokenSet ? <RefreshCw aria-hidden className="size-3.5" /> : <KeyRound aria-hidden className="size-3.5" />}
            {tokenSet ? "Rotate token" : "Generate token"}
          </Button>
          {tokenSet && (
            <Button variant="ghost" size="md" disabled={busy} onClick={onClear}>
              <Trash2 aria-hidden className="size-3.5" />
              Revoke token
            </Button>
          )}
        </div>
      )}
    </SettingsCard>
  );
}
