"use client";

import { Unplug } from "lucide-react";
import { toast } from "sonner";
import Button from "@/components/_ui/button";
import Tag from "@/components/_ui/tag";
import SettingsCard from "@/components/settings/settings-card";
import { api, useApi } from "@/lib/client/api";
import { timeAgo } from "@/lib/client/format";
import type { McpClients } from "./types";

export default function ClientsCard() {
  const { data, mutate } = useApi<McpClients>("/api/mcp/clients", { refreshInterval: 15000 });
  const clients = data?.clients ?? [];

  async function disconnect(familyId: string, name: string) {
    if (!window.confirm(`Disconnect ${name}? It loses access immediately and has to sign in again.`)) return;
    try {
      await api("/api/mcp/clients", { method: "DELETE", body: { familyId } });
      toast.success(`${name} disconnected`);
      mutate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not disconnect");
    }
  }

  return (
    <SettingsCard
      id="clients"
      title="Connected clients"
      description="Assistants that signed in to this workspace with OAuth. Disconnecting revokes their tokens right away."
      aside={data && <Tag size="sm" className="text-[12px]">{clients.length} connected</Tag>}
    >
      {!data ? (
        <div className="bg-secondary h-12 animate-pulse rounded-lg" />
      ) : clients.length === 0 ? (
        <p className="caption-style text-subtle">No assistant is connected yet. Use one of the options above; it shows up here after you approve it.</p>
      ) : (
        <ul className="border-border divide-border flex flex-col divide-y rounded-lg border">
          {clients.map((c) => (
            <li key={c.familyId} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{c.clientName}</span>
                  {!c.scopes.includes("mcp") && (
                    <Tag tone="green" size="sm" className="text-[11px]">
                      read only
                    </Tag>
                  )}
                </div>
                <span className="caption-style text-subtle truncate">
                  {c.mine ? "You" : (c.userName ?? c.userEmail)} · connected {timeAgo(c.connectedAt)} · last used {timeAgo(c.lastUsedAt)}
                </span>
              </div>
              {c.canRevoke && (
                <Button variant="ghost" size="md" onClick={() => disconnect(c.familyId, c.clientName)}>
                  <Unplug aria-hidden className="size-3.5" />
                  Disconnect
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </SettingsCard>
  );
}
