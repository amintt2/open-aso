"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { SyncResult } from "@/lib/asc/analytics/types";
import { api, revalidate } from "@/lib/client/api";
import { formatDay } from "./format";

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function useStoreSync(appId: number) {
  const [syncing, setSyncing] = useState(false);
  async function refresh() {
    await Promise.all([revalidate("/api/store-analytics"), revalidate(`/api/apps/${appId}/traffic`)]);
  }
  async function sync(opts: { force?: boolean; fixtures?: "data" | "waiting" } = {}) {
    setSyncing(true);
    try {
      const r = await api<SyncResult>("/api/store-analytics/sync", { method: "POST", body: { appId, ...opts } });
      if (r.outcome === "up-to-date")
        toast(`Already up to date: data through ${formatDay(r.dataThrough)}`, {
          description: "Apple publishes once a day. Nothing to fetch until tomorrow.",
          action: { label: "Check anyway", onClick: () => void sync({ ...opts, force: true }) },
        });
      else if (r.outcome === "new-data") toast.success(`Imported ${plural(r.instances, "report")} from Apple`, { description: `Data through ${formatDay(r.dataThrough)} · ${plural(r.calls, "API call")}` });
      else if (r.outcome === "waiting") toast(r.message ?? "Waiting for Apple to generate the first report");
      else toast("No new data from Apple yet", { description: `${plural(r.calls, "API call")} · we'll check again automatically.` });
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed");
      await refresh();
    } finally {
      setSyncing(false);
    }
  }
  return { syncing, sync };
}
