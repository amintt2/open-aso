"use client";

import { ArrowUpRight } from "lucide-react";
import Button from "@/components/_ui/button";
import type { TrackedApp } from "@/lib/client/types";
import { useApi } from "@/lib/client/api";
import { timeAgo } from "@/lib/client/format";
import type { AdsStatusLite, AscStatusLite } from "./external-status";
import { Section, Step } from "./shared";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <span className="caption-style text-subtle">{label}</span>
      <span className="caption-style text-foreground truncate text-right">
        {value}
      </span>
    </div>
  );
}

export function AscPanel({
  status,
  unavailable,
}: {
  status: AscStatusLite | null;
  unavailable: boolean;
}) {
  const { data: apps } = useApi<TrackedApp[]>("/api/apps");
  const app = apps?.find((a) => a.isMine) ?? apps?.[0];
  const sample =
    typeof status?.sampleApp === "string"
      ? status.sampleApp
      : status?.sampleApp?.name;
  return (
    <div className="flex flex-col gap-8">
      <Section title="Status">
        {unavailable ? (
          <p className="text-subtle">
            The App Store Connect module isn&apos;t available in this build.
          </p>
        ) : (
          <div className="divide-line-strong divide-y">
            <Row
              label="API key"
              value={
                status?.configured
                  ? (status.keyId ?? "Configured")
                  : "Not configured"
              }
            />
            <Row
              label="Connection"
              value={
                status?.connected
                  ? "Verified"
                  : status?.configured
                    ? "Failed"
                    : "—"
              }
            />
            {sample && <Row label="Sample app" value={sample} />}
            {status?.error && (
              <Row
                label="Last error"
                value={<span className="text-danger">{status.error}</span>}
              />
            )}
          </div>
        )}
      </Section>
      <Section title="Setup">
        <ol className="flex flex-col gap-6">
          <Step n={1} title="Create an App Store Connect API key">
            <p className="text-soft">
              In App Store Connect open Users and Access → Integrations → App
              Store Connect API and generate a Team key with the App Manager
              role. Download the .p8 file once.
            </p>
          </Step>
          <Step n={2} title="Connect it to Open ASO">
            <p className="text-soft">
              Add the issuer id, key id and private key on an app&apos;s App
              Store Page screen. Metadata edits and localizations are pushed
              with it.
            </p>
            {app ? (
              <Button
                variant="primary"
                size="sm"
                href={`/apps/${app.id}/page`}
                className="self-start"
              >
                Open App Store Page setup
                <ArrowUpRight aria-hidden className="size-3.5" />
              </Button>
            ) : (
              <p className="caption-style text-subtle">
                Add an app first, then open its App Store Page screen.
              </p>
            )}
          </Step>
        </ol>
      </Section>
    </div>
  );
}

export function AppleAdsPanel({
  status,
  unavailable,
}: {
  status: AdsStatusLite | null;
  unavailable: boolean;
}) {
  const c = status?.connection;
  return (
    <div className="flex flex-col gap-8">
      <Section title="Status">
        {unavailable ? (
          <p className="text-subtle">
            The Apple Ads module isn&apos;t available in this build.
          </p>
        ) : (
          <div className="divide-line-strong divide-y">
            <Row
              label="API credentials"
              value={c?.configured ? "Configured" : "Not configured"}
            />
            <Row
              label="Organization"
              value={
                c?.orgName
                  ? `${c.orgName}${c.orgId ? ` · ${c.orgId}` : ""}`
                  : (c?.orgId ?? "—")
              }
            />
            {c?.currency && <Row label="Currency" value={c.currency} />}
            {c?.lastCheckedAt && (
              <Row label="Last checked" value={timeAgo(c.lastCheckedAt)} />
            )}
            {c?.lastError && (
              <Row
                label="Last error"
                value={<span className="text-danger">{c.lastError}</span>}
              />
            )}
          </div>
        )}
      </Section>
      <Section title="Why connect it">
        <p className="text-soft">
          Apple Ads keyword reports provide the spend side of Keyword ROAS.
          Installs attributed by the Open ASO SDK are joined to those keywords
          by keyword id, and their RevenueCat/Superwall revenue gives you cohort
          ROAS per keyword.
        </p>
        <Button
          variant="primary"
          size="sm"
          href="/apple-ads"
          className="self-start"
        >
          {c?.connected ? "Open Apple Ads" : "Connect Apple Ads"}
          <ArrowUpRight aria-hidden className="size-3.5" />
        </Button>
      </Section>
    </div>
  );
}
