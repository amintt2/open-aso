"use client";

import { useApi } from "@/lib/client/api";

export type AnalyticsFilterState = { appId: string; days: number; sandbox: boolean };

export function analyticsUrl(view: string, filters: AnalyticsFilterState, extra?: Record<string, string>) {
  const qs = new URLSearchParams({ days: String(filters.days), ...extra });
  if (filters.appId !== "all") qs.set("appId", filters.appId);
  if (filters.sandbox) qs.set("sandbox", "1");
  return `/api/analytics/${view}?${qs.toString()}`;
}

export function useAnalytics<T>(view: string, filters: AnalyticsFilterState, extra?: Record<string, string>) {
  return useApi<T>(analyticsUrl(view, filters, extra), { keepPreviousData: true });
}
