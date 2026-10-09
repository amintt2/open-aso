"use client";

import { useCallback, useMemo, useState } from "react";
import KeywordDetailSheet from "@/components/keywords/keyword-detail-sheet";
import TopAppsSheet from "@/components/keywords/top-apps-sheet";
import { useKeywordActions } from "@/components/keywords/use-keyword-actions";
import { useRefreshQueue } from "@/components/keywords/use-refresh-queue";
import { revalidate, useApi } from "@/lib/client/api";
import type { TrackedApp, TrackedKeyword } from "@/lib/client/types";

export type SheetPanel = { type: "detail" | "top"; id: number } | null;

export default function TrendKeywordSheets({ app, panel, onPanel }: { app: TrackedApp; panel: SheetPanel; onPanel: (panel: SheetPanel) => void }) {
  const [wanted, setWanted] = useState(false);
  if (panel && !wanted) setWanted(true);
  const { data, mutate } = useApi<TrackedKeyword[]>(wanted ? `/api/apps/${app.id}/keywords` : null);
  const byId = useMemo(() => new Map((data ?? []).map((k) => [k.id, k])), [data]);
  const actions = useKeywordActions(app.id, mutate);
  const onBatch = useCallback(() => Promise.all([mutate(), revalidate(`/api/apps/${app.id}/trends`), revalidate("/api/keywords/")]), [mutate, app.id]);
  const { refreshing, enqueue } = useRefreshQueue(onBatch);
  const onNotesSaved = useCallback(
    (id: number, notes: string | null) => void mutate((list) => list?.map((k) => (k.id === id ? { ...k, notes } : k)), { revalidate: false }),
    [mutate],
  );
  const close = () => onPanel(null);

  return (
    <>
      <KeywordDetailSheet
        app={app}
        keyword={panel?.type === "detail" ? byId.get(panel.id) : undefined}
        refreshing={panel ? refreshing.has(panel.id) : false}
        onClose={close}
        onLike={(ids, liked) => void actions.setLiked(ids, liked)}
        onRefresh={(ids) => void enqueue(ids)}
        onTopApps={(id) => onPanel({ type: "top", id })}
        onNotesSaved={onNotesSaved}
      />
      <TopAppsSheet app={app} keyword={panel?.type === "top" ? byId.get(panel.id) : undefined} onClose={close} />
    </>
  );
}
