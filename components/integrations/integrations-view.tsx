"use client";

import { useState, type ReactNode } from "react";
import {
  ChevronRight,
  CodeXml,
  Megaphone,
  ReceiptText,
  Store,
  Webhook,
} from "lucide-react";
import PageHeader from "@/components/shell/page-header";
import { ScrollArea } from "@/components/_ui/scroll-area";
import Button from "@/components/_ui/button";
import type { IntegrationsStatus } from "@/lib/integrations/status";
import type { ProviderActivity } from "@/lib/integrations/log";
import { useApi } from "@/lib/client/api";
import { timeAgo } from "@/lib/client/format";
import IntegrationDetailSheet from "./integration-detail-sheet";
import RevenueCatPanel from "./revenuecat-panel";
import SuperwallPanel from "./superwall-panel";
import SdkPanel from "./sdk-panel";
import { AppleAdsPanel, AscPanel } from "./external-panels";
import {
  useOptionalApi,
  type AdsStatusLite,
  type AscStatusLite,
} from "./external-status";
import { StatusTag, type CardState } from "./shared";
import PosthogPanel from "@/components/posthog/posthog-panel";
import {
  POSTHOG_DESCRIPTION,
  PosthogGlyph,
  posthogCardState,
} from "@/components/posthog/posthog-sheet";

type Key = "asc" | "ads" | "revenuecat" | "superwall" | "sdk" | "posthog";

type Card = {
  key: Key;
  title: string;
  description: string;
  icon: ReactNode;
  state: CardState;
  stateLabel?: string;
  detail: string;
};

function Glyph({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  return (
    <span
      className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${className}`}
    >
      {children}
    </span>
  );
}

function webhookState(
  configured: boolean,
  activity: ProviderActivity | undefined,
): CardState {
  if (!configured) return "off";
  if (
    activity?.lastError &&
    (!activity.lastEvent || activity.lastError.id > activity.lastEvent.id)
  )
    return "error";
  return activity?.lastEvent ? "connected" : "waiting";
}

function lastSeen(activity: ProviderActivity | undefined, configured: boolean) {
  if (
    activity?.lastError &&
    (!activity.lastEvent || activity.lastError.id > activity.lastEvent.id)
  )
    return `Error ${timeAgo(activity.lastError.receivedAt)}: ${activity.lastError.message ?? "unknown"}`;
  if (activity?.lastEvent)
    return `Last event ${timeAgo(activity.lastEvent.receivedAt)} · ${activity.lastEvent.eventType ?? activity.lastEvent.status}`;
  return configured ? "No events received yet" : "Not set up";
}

export default function IntegrationsView() {
  const { data: status } = useApi<IntegrationsStatus>("/api/integrations", {
    refreshInterval: 10000,
  });
  const asc = useOptionalApi<AscStatusLite>("/api/asc/status");
  const ads = useOptionalApi<AdsStatusLite>("/api/apple-ads/connection");
  const [open, setOpen] = useState<Key | null>(null);
  const [tokens, setTokens] = useState<{
    revenuecat: string | null;
    sdk: string | null;
  }>({ revenuecat: null, sdk: null });

  const ascState: CardState = asc.isLoading
    ? "loading"
    : asc.data === null || asc.error
      ? "off"
      : asc.data?.connected
        ? "connected"
        : asc.data?.configured
          ? "error"
          : "off";
  const adsConn = ads.data?.connection;
  const posthogCard = posthogCardState(status?.posthog);
  const adsState: CardState = ads.isLoading
    ? "loading"
    : !adsConn
      ? "off"
      : adsConn.lastError
        ? "error"
        : adsConn.connected
          ? "connected"
          : adsConn.configured
            ? "waiting"
            : "off";

  const cards: Card[] = [
    {
      key: "asc",
      title: "App Store Connect",
      description: "Push metadata and localizations, read your apps.",
      icon: (
        <Glyph className="bg-(--tag-blue-bg) text-(--tag-blue-text)">
          <Store aria-hidden className="size-5" />
        </Glyph>
      ),
      state: ascState,
      stateLabel: ascState === "error" ? "Connection failed" : undefined,
      detail:
        asc.data === null
          ? "Module unavailable"
          : asc.data?.error
            ? asc.data.error
            : asc.data?.connected
              ? "API key verified"
              : "Add an API key",
    },
    {
      key: "ads",
      title: "Apple Ads",
      description: "Keyword spend, taps and installs for ROAS.",
      icon: (
        <Glyph className="bg-(--tag-purple-bg) text-(--tag-purple-text)">
          <Megaphone aria-hidden className="size-5" />
        </Glyph>
      ),
      state: adsState,
      stateLabel: adsState === "waiting" ? "Choose an org" : undefined,
      detail:
        ads.data === null
          ? "Module unavailable"
          : adsConn?.lastError
            ? adsConn.lastError
            : adsConn?.orgName
              ? adsConn.orgName
              : adsConn?.configured
                ? "Credentials saved"
                : "Not set up",
    },
    {
      key: "revenuecat",
      title: "RevenueCat",
      description: "Subscription and purchase events via webhook.",
      icon: (
        <Glyph className="bg-(--tag-red-bg) text-(--tag-red-text)">
          <ReceiptText aria-hidden className="size-5" />
        </Glyph>
      ),
      state: status
        ? webhookState(status.revenuecat.configured, status.revenuecat)
        : "loading",
      detail: status
        ? lastSeen(status.revenuecat, status.revenuecat.configured)
        : "",
    },
    {
      key: "superwall",
      title: "Superwall",
      description: "Paywall revenue events, signed with Svix.",
      icon: (
        <Glyph className="bg-(--tag-teal-bg) text-(--tag-teal-text)">
          <Webhook aria-hidden className="size-5" />
        </Glyph>
      ),
      state: status
        ? webhookState(status.superwall.configured, status.superwall)
        : "loading",
      detail: status
        ? lastSeen(status.superwall, status.superwall.configured)
        : "",
    },
    {
      key: "sdk",
      title: "Open ASO SDK",
      description:
        "AdServices attribution, installs and sessions from your app.",
      icon: (
        <Glyph className="bg-(--tag-amber-bg) text-(--tag-amber-text)">
          <CodeXml aria-hidden className="size-5" />
        </Glyph>
      ),
      state: status
        ? webhookState(status.sdk.configured, status.sdk)
        : "loading",
      detail: status
        ? status.sdk.lastInstallAt
          ? `${status.sdk.installs} installs · last ${timeAgo(status.sdk.lastInstallAt)}`
          : lastSeen(status.sdk, status.sdk.configured)
        : "",
    },
    {
      key: "posthog",
      title: "PostHog",
      description: POSTHOG_DESCRIPTION,
      icon: <PosthogGlyph />,
      state: posthogCard.state,
      stateLabel: posthogCard.label,
      detail: posthogCard.detail,
    },
  ];

  const current = cards.find((c) => c.key === open);

  return (
    <>
      <PageHeader title="Integrations" />
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 p-4">
          <p className="text-soft max-w-[720px]">
            Connect this workspace&apos;s data sources. Webhooks and the SDK
            post straight to Open ASO and are routed to this workspace by its
            own tokens and signing secrets. Tokens are stored hashed and secrets
            encrypted; neither is sent back to the browser.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {cards.map((card) => (
              <button
                key={card.key}
                type="button"
                onClick={() => setOpen(card.key)}
                className="bg-card border-border group ease-power3-out hover:border-line-strong focus-visible:ring-ring/60 flex cursor-pointer flex-col gap-4 rounded-xl border p-4 text-left transition-colors duration-150 outline-none focus-visible:ring-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    {card.icon}
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <h2 className="h3-style">{card.title}</h2>
                      <p className="caption-style text-subtle truncate">
                        {card.description}
                      </p>
                    </div>
                  </div>
                  <StatusTag state={card.state} label={card.stateLabel} />
                </div>
                <div className="border-border flex items-center justify-between gap-3 border-t pt-3">
                  <span
                    className={`caption-style truncate ${card.state === "error" ? "text-danger" : "text-soft"}`}
                  >
                    {card.detail || " "}
                  </span>
                  <span className="caption-style text-subtle group-hover:text-foreground flex shrink-0 items-center gap-1 transition-colors duration-150">
                    Configure
                    <ChevronRight aria-hidden className="size-3.5" />
                  </span>
                </div>
              </button>
            ))}
          </div>
          <div className="bg-card border-border flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
            <div className="flex flex-col gap-1.5">
              <h2 className="h3-style">See it come together</h2>
              <p className="caption-style text-subtle">
                Installs, trials, revenue, retention and keyword ROAS are on the
                Analytics page.
              </p>
            </div>
            <Button variant="secondary" size="sm" href="/analytics">
              Open Analytics
            </Button>
          </div>
        </div>
      </ScrollArea>
      {current && (
        <IntegrationDetailSheet
          open={!!open}
          onOpenChange={(o) => !o && setOpen(null)}
          title={current.title}
          description={current.description}
          icon={current.icon}
          state={current.state}
          stateLabel={current.stateLabel}
        >
          {open === "asc" && (
            <AscPanel
              status={asc.data ?? null}
              unavailable={asc.data === null}
            />
          )}
          {open === "ads" && (
            <AppleAdsPanel
              status={ads.data ?? null}
              unavailable={ads.data === null}
            />
          )}
          {open === "revenuecat" && status && (
            <RevenueCatPanel
              status={status.revenuecat}
              canManage={status.canManage}
              token={tokens.revenuecat}
              onToken={(t) => setTokens((s) => ({ ...s, revenuecat: t }))}
            />
          )}
          {open === "superwall" && status && (
            <SuperwallPanel
              status={status.superwall}
              canManage={status.canManage}
            />
          )}
          {open === "sdk" && status && (
            <SdkPanel
              status={status.sdk}
              canManage={status.canManage}
              token={tokens.sdk}
              onToken={(t) => setTokens((s) => ({ ...s, sdk: t }))}
            />
          )}
          {open === "posthog" && <PosthogPanel />}
        </IntegrationDetailSheet>
      )}
    </>
  );
}
