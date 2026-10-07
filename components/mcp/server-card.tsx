"use client";

import SettingsCard, { KeyValue } from "@/components/settings/settings-card";
import CopyField from "@/components/integrations/copy-field";
import { formatCompact, timeAgo } from "@/lib/client/format";
import ToggleRow from "./toggle-row";
import type { McpStatus } from "./types";

export default function ServerCard({ url, enabled, status, saving, onToggle }: { url: string; enabled: boolean; status: McpStatus | undefined; saving: boolean; onToggle: (next: boolean) => void }) {
  const stats = status?.stats;
  return (
    <SettingsCard
      id="server"
      title="Server"
      description="Expose Open ASO to AI assistants over the Model Context Protocol. Clients connect to one Streamable HTTP endpoint; every tool runs on this machine against your local data."
    >
      <ToggleRow
        id="mcp-enabled"
        label="Enable MCP server"
        description={enabled ? "The endpoint accepts authenticated requests." : "The endpoint answers every request with an error until enabled."}
        checked={enabled}
        disabled={saving}
        onChange={onToggle}
      />
      <CopyField label="Endpoint URL" value={url} />
      <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
        <KeyValue label="Requests" value={stats ? formatCompact(stats.requests) : "—"} />
        <KeyValue label="Tool calls" value={stats ? `${formatCompact(stats.toolCalls)}${stats.toolErrors ? ` · ${formatCompact(stats.toolErrors)} failed` : ""}` : "—"} />
        <KeyValue label="Last request" value={stats ? timeAgo(stats.lastRequestAt) : "—"} />
        <KeyValue label="Last tool" value={stats?.lastTool ? <code className="block truncate font-mono text-[13px]" title={stats.lastTool}>{stats.lastTool}</code> : "—"} />
      </div>
      {stats && (stats.lastClient || stats.rejected > 0) && (
        <div className="caption-style text-subtle flex flex-col gap-1">
          {stats.lastClient && <span className="truncate">Last client: {stats.lastClient}</span>}
          {stats.rejected > 0 && (
            <span className="break-words">
              {formatCompact(stats.rejected)} rejected {stats.rejected === 1 ? "request" : "requests"}
              {stats.lastRejection ? ` · last: ${stats.lastRejection.split(" · ").slice(1).join(" · ")}` : ""}
            </span>
          )}
          <span>Counters reset when the server restarts (since {new Date(stats.startedAt).toLocaleString()}).</span>
        </div>
      )}
    </SettingsCard>
  );
}
