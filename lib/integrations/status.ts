import { db } from "@/lib/server/db";
import { getSetting } from "@/lib/server/settings";
import { tokenInfo } from "@/lib/server/tokens";
import { posthogStatus } from "@/lib/posthog/status";
import type { PosthogStatus } from "@/lib/posthog/types";
import { providerActivity, type ProviderActivity } from "./log";

type TokenState = {
  configured: boolean;
  tokenHint: string | null;
  tokenCreatedAt: string | null;
  tokenLastUsedAt: string | null;
};

export type IntegrationsStatus = {
  workspaceId: string;
  canManage: boolean;
  revenuecat: ProviderActivity & TokenState & { path: string; events: number };
  superwall: ProviderActivity & {
    configured: boolean;
    secretHint: string | null;
    path: string;
    events: number;
  };
  sdk: ProviderActivity &
    TokenState & {
      installPath: string;
      eventPath: string;
      installs: number;
      appleAdsInstalls: number;
      pendingAttribution: number;
      lastInstallAt: string | null;
    };
  posthog: PosthogStatus;
};

async function tokenState(
  workspaceId: string,
  kind: "revenuecat" | "sdk",
): Promise<TokenState> {
  const info = await tokenInfo(workspaceId, kind);
  return {
    configured: !!info,
    tokenHint: info?.hint ?? null,
    tokenCreatedAt: info?.created_at ?? null,
    tokenLastUsedAt: info?.last_used_at ?? null,
  };
}

export function superwallPath(workspaceId: string) {
  return `/api/integrations/superwall?w=${encodeURIComponent(workspaceId)}`;
}

export async function integrationsStatus(
  workspaceId: string,
  canManage = false,
): Promise<IntegrationsStatus> {
  const [
    rc,
    sdk,
    sw,
    events,
    installs,
    pending,
    rcActivity,
    swActivity,
    sdkActivity,
    posthog,
  ] = await Promise.all([
    tokenState(workspaceId, "revenuecat"),
    tokenState(workspaceId, "sdk"),
    getSetting(workspaceId, "integrations.superwall.secret"),
    db.all<{ provider: string; n: number }>(
      "SELECT provider, COUNT(*) AS n FROM revenue_events WHERE workspace_id = ? GROUP BY provider",
      [workspaceId],
    ),
    db.get<{ n: number; ads: number; last: string | null }>(
      "SELECT COUNT(*) AS n, COUNT(*) FILTER (WHERE source = 'apple_ads') AS ads, MAX(installed_at) AS last FROM installs WHERE workspace_id = ?",
      [workspaceId],
    ),
    db.get<{ n: number }>(
      "SELECT COUNT(*) AS n FROM attribution_pending WHERE workspace_id = ? AND status = 'pending'",
      [workspaceId],
    ),
    providerActivity(workspaceId, "revenuecat"),
    providerActivity(workspaceId, "superwall"),
    providerActivity(workspaceId, "sdk"),
    posthogStatus(workspaceId),
  ]);
  const providerEvents = (provider: string) =>
    events.find((e) => e.provider === provider)?.n ?? 0;
  return {
    workspaceId,
    canManage,
    revenuecat: {
      ...rcActivity,
      ...rc,
      path: "/api/integrations/revenuecat",
      events: providerEvents("revenuecat"),
    },
    superwall: {
      ...swActivity,
      configured: !!sw,
      secretHint: sw ? `whsec_••••${sw.slice(-4)}` : null,
      path: superwallPath(workspaceId),
      events: providerEvents("superwall"),
    },
    sdk: {
      ...sdkActivity,
      ...sdk,
      installPath: "/api/attribution/install",
      eventPath: "/api/attribution/event",
      installs: installs?.n ?? 0,
      appleAdsInstalls: installs?.ads ?? 0,
      pendingAttribution: pending?.n ?? 0,
      lastInstallAt: installs?.last ?? null,
    },
    posthog,
  };
}
