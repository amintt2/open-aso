"use client";

import { useState } from "react";
import { toast } from "sonner";
import { mutate } from "swr";
import { api, useApi } from "@/lib/client/api";
import type { PosthogMeta, PosthogView } from "@/lib/posthog/types";

export type ProductTarget = {
  appId: number | null;
  demo: string | null;
  days: number;
};

export function posthogUrl(
  view: PosthogView,
  target: ProductTarget,
  extra?: Record<string, string>,
) {
  const qs = new URLSearchParams({ days: String(target.days), ...extra });
  if (target.demo) qs.set("demo", target.demo);
  else if (target.appId) qs.set("appId", String(target.appId));
  return `/api/posthog/${view}?${qs.toString()}`;
}

export function usePosthogView<T extends PosthogMeta>(
  view: PosthogView,
  target: ProductTarget,
  ready = true,
) {
  const url =
    ready && (target.demo || target.appId) ? posthogUrl(view, target) : null;
  const swr = useApi<T>(url, {
    keepPreviousData: true,
    shouldRetryOnError: false,
  });
  const [refreshing, setRefreshing] = useState(false);
  async function refresh() {
    if (!url) return;
    setRefreshing(true);
    try {
      const data = await api<T>(`${url}&refresh=1`);
      await mutate(url, data, { revalidate: false });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }
  return { ...swr, refresh, refreshing };
}
