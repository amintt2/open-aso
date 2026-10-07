"use client";

import { useState, useSyncExternalStore } from "react";
import { Power, PowerOff } from "lucide-react";
import { toast } from "sonner";
import Tag from "@/components/_ui/tag";
import { ScrollArea } from "@/components/_ui/scroll-area";
import PageHeader from "@/components/shell/page-header";
import { api, revalidate, useApi } from "@/lib/client/api";
import AccessCard from "./access-card";
import ServerCard from "./server-card";
import SetupCard from "./setup-card";
import ToolsCard from "./tools-card";
import type { McpSettings, McpStatus } from "./types";
import WritesCard from "./writes-card";

const SECTIONS = [
  { id: "server", label: "Server" },
  { id: "access", label: "Access token" },
  { id: "writes", label: "Write tools" },
  { id: "setup", label: "Connect a client" },
  { id: "tools", label: "Tools" },
];

const noop = () => () => {};

export default function McpView() {
  const { data: settings, mutate } = useApi<McpSettings>("/api/mcp/settings");
  const { data: status } = useApi<McpStatus>("/api/mcp/status", { refreshInterval: 5000 });
  const origin = useSyncExternalStore(noop, () => window.location.origin, () => "");
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const url = `${origin}/api/mcp`;

  async function run<T>(action: () => Promise<T>, message: string) {
    setBusy(true);
    try {
      const result = await action();
      toast.success(message);
      return result;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
      return null;
    } finally {
      setBusy(false);
      revalidate("/api/mcp/status");
    }
  }

  async function update(patch: { enabled?: boolean; allowWrites?: boolean }, message: string) {
    const next = await run(() => api<McpSettings>("/api/mcp/settings", { method: "PUT", body: patch }), message);
    if (next) mutate(next, { revalidate: false });
  }

  async function rotate() {
    if (settings?.tokenSet && !window.confirm("Rotate the token? Clients using the current token stop working until you update them.")) return;
    const result = await run(() => api<{ token: string }>("/api/mcp/settings/token", { method: "POST" }), settings?.tokenSet ? "Token rotated" : "Token generated");
    if (!result) return;
    setToken(result.token);
    mutate();
  }

  async function clear() {
    if (!window.confirm("Revoke the token? Every client using it stops working immediately.")) return;
    if (!(await run(() => api("/api/mcp/settings/token", { method: "DELETE" }), "Token revoked"))) return;
    setToken(null);
    mutate();
  }

  const enabled = settings?.enabled ?? false;
  return (
    <>
      <PageHeader
        title="MCP Server"
        badge={
          settings && (
            <Tag tone={enabled ? "green" : "neutral"} size="sm" className="gap-1.5 text-[12px]">
              {enabled ? <Power aria-hidden className="size-3" /> : <PowerOff aria-hidden className="size-3" />}
              {enabled ? "Running" : "Off"}
            </Tag>
          )
        }
      />
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto flex w-full max-w-[960px] flex-col gap-4 p-4">
          <nav aria-label="MCP sections" className="flex flex-wrap gap-1">
            {SECTIONS.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="caption-style text-subtle hover:text-foreground rounded-full px-2.5 py-1.5 transition-colors duration-150 hover:bg-white/6">
                {s.label}
              </a>
            ))}
          </nav>
          {settings ? (
            <>
              {!settings.canManage && <p className="caption-style text-subtle">Only workspace owners and admins can change MCP settings or tokens.</p>}
              <ServerCard url={url} enabled={enabled} status={status} saving={busy || !settings.canManage} onToggle={(next) => update({ enabled: next }, next ? "MCP server enabled" : "MCP server disabled")} />
              <AccessCard tokenSet={settings.tokenSet} hint={settings.tokenHint} lastUsedAt={settings.tokenLastUsedAt} revealed={token} busy={busy} canManage={settings.canManage} onRotate={rotate} onClear={clear} />
              <WritesCard allowWrites={settings.allowWrites} saving={busy || !settings.canManage} onToggle={(next) => update({ allowWrites: next }, next ? "Write tools allowed" : "Write tools blocked")} />
              <SetupCard url={url} tokenRequired token={token} />
              <ToolsCard layers={settings.layers} tools={settings.tools} allowWrites={settings.allowWrites} />
            </>
          ) : (
            <div className="bg-card border-border h-[220px] animate-pulse rounded-xl border" />
          )}
        </div>
      </ScrollArea>
    </>
  );
}
