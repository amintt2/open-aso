"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import type { KeyedMutator } from "swr";
import { api, revalidate } from "@/lib/client/api";
import type { TrackedKeyword } from "@/lib/client/types";
import { downloadCsv } from "@/lib/csv";
import { csvRows } from "@/lib/keywords/table";

export function useKeywordActions(
  appId: number,
  mutate: KeyedMutator<TrackedKeyword[]>,
) {
  const setLiked = useCallback(
    async (ids: number[], liked: boolean) => {
      const set = new Set(ids);
      await mutate(
        async (current) => {
          if (ids.length === 1)
            await api(`/api/keywords/${ids[0]}`, {
              method: "PATCH",
              body: { liked },
            });
          else
            await api("/api/keywords", {
              method: "PATCH",
              body: { ids, liked },
            });
          return current?.map((k) => (set.has(k.id) ? { ...k, liked } : k));
        },
        {
          optimisticData: (current) =>
            (current ?? []).map((k) => (set.has(k.id) ? { ...k, liked } : k)),
          rollbackOnError: true,
          revalidate: false,
        },
      ).catch((e: unknown) =>
        toast.error(
          e instanceof Error ? e.message : "Could not update keywords",
        ),
      );
    },
    [mutate],
  );

  const remove = useCallback(
    async (ids: number[]) => {
      const set = new Set(ids);
      try {
        await mutate(
          async (current) => {
            await api(`/api/apps/${appId}/keywords`, {
              method: "DELETE",
              body: { ids },
            });
            return current?.filter((k) => !set.has(k.id));
          },
          {
            optimisticData: (current) =>
              (current ?? []).filter((k) => !set.has(k.id)),
            rollbackOnError: true,
            revalidate: false,
          },
        );
        void revalidate("/api/apps");
        toast.success(
          ids.length === 1
            ? "Keyword deleted"
            : `${ids.length} keywords deleted`,
        );
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Could not delete keywords",
        );
      }
    },
    [appId, mutate],
  );

  const copy = useCallback(async (terms: string[]) => {
    try {
      await navigator.clipboard.writeText(terms.join("\n"));
      toast.success(
        terms.length === 1
          ? "Keyword copied"
          : `${terms.length} keywords copied`,
      );
    } catch {
      toast.error("Clipboard is not available");
    }
  }, []);

  const exportCsv = useCallback((list: TrackedKeyword[], name: string) => {
    if (!list.length) return toast.error("Nothing to export");
    downloadCsv(`${name}.csv`, csvRows(list));
  }, []);

  return { setLiked, remove, copy, exportCsv };
}
