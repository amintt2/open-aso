"use client";

import { useParams } from "next/navigation";
import { useApi } from "@/lib/client/api";
import type { TrackedApp } from "@/lib/client/types";
import { useUiStore } from "@/stores/ui-store";

export const ALL_COUNTRIES = "all";

export function useAppId() {
  const params = useParams<{ appId: string }>();
  return Number(params.appId);
}

export function useCurrentApp() {
  const appId = useAppId();
  const { data: app, error, isLoading, mutate } = useApi<TrackedApp>(appId ? `/api/apps/${appId}` : null);
  return { appId, app, error, isLoading, mutate };
}

export function useAppCountry(app: TrackedApp | undefined, options?: { allowAll?: boolean }) {
  const countryByApp = useUiStore((s) => s.countryByApp);
  const setCountry = useUiStore((s) => s.setCountry);
  const stored = app ? countryByApp[app.id] : undefined;
  const country = !app ? "us" : stored && (stored !== ALL_COUNTRIES || options?.allowAll) ? stored : app.primaryCountry;
  return [country, (c: string) => app && setCountry(app.id, c)] as const;
}
