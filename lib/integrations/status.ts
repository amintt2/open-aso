import { getSetting } from "@/lib/server/settings";
import { analyticsDb } from "@/lib/analytics/schema";
import { maskSecret } from "./secrets";
import { providerActivity, type ProviderActivity } from "./log";
import { posthogStatus } from "@/lib/posthog/status";
import type { PosthogStatus } from "@/lib/posthog/types";

export type IntegrationsStatus = {
  revenuecat: ProviderActivity & { configured: boolean; tokenHint: string | null; path: string; events: number };
  superwall: ProviderActivity & { configured: boolean; secretHint: string | null; path: string; events: number };
  sdk: ProviderActivity & {
    configured: boolean;
    tokenHint: string | null;
    installPath: string;
    eventPath: string;
    installs: number;
    appleAdsInstalls: number;
    pendingAttribution: number;
    lastInstallAt: string | null;
  };
  posthog: PosthogStatus;
};

export function integrationsStatus(): IntegrationsStatus {
  const d = analyticsDb();
  const rc = getSetting("integrations.revenuecat.token");
  const sw = getSetting("integrations.superwall.secret");
  const sdk = getSetting("integrations.sdk.token");
  const providerEvents = (provider: string) => (d.prepare("SELECT COUNT(*) AS n FROM revenue_events WHERE provider = ?").get(provider) as { n: number }).n;
  const installs = d.prepare("SELECT COUNT(*) AS n, SUM(source = 'apple_ads') AS ads, MAX(installed_at) AS last FROM installs").get() as { n: number; ads: number | null; last: string | null };
  const pending = (d.prepare("SELECT COUNT(*) AS n FROM attribution_pending WHERE status = 'pending'").get() as { n: number }).n;
  return {
    revenuecat: { ...providerActivity("revenuecat"), configured: !!rc, tokenHint: maskSecret(rc), path: "/api/integrations/revenuecat", events: providerEvents("revenuecat") },
    superwall: { ...providerActivity("superwall"), configured: !!sw, secretHint: sw ? `whsec_••••${sw.slice(-4)}` : null, path: "/api/integrations/superwall", events: providerEvents("superwall") },
    sdk: {
      ...providerActivity("sdk"),
      configured: !!sdk,
      tokenHint: maskSecret(sdk),
      installPath: "/api/attribution/install",
      eventPath: "/api/attribution/event",
      installs: installs.n,
      appleAdsInstalls: installs.ads ?? 0,
      pendingAttribution: pending,
      lastInstallAt: installs.last,
    },
    posthog: posthogStatus(),
  };
}
