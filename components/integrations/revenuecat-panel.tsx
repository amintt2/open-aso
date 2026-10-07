"use client";

import type { IntegrationsStatus } from "@/lib/integrations/status";
import { timeAgo } from "@/lib/client/format";
import CopyField, { CodeBlock } from "./copy-field";
import {
  EventLog,
  LocalhostNotice,
  Section,
  Step,
  TokenManager,
  useOrigin,
} from "./shared";

export default function RevenueCatPanel({
  status,
  canManage,
  token,
  onToken,
}: {
  status: IntegrationsStatus["revenuecat"];
  canManage: boolean;
  token: string | null;
  onToken: (t: string | null) => void;
}) {
  const origin = useOrigin();
  const url = `${origin}${status.path}`;
  return (
    <div className="flex flex-col gap-8">
      <LocalhostNotice origin={origin} who="RevenueCat's servers" />
      <Section title="Setup">
        <ol className="flex flex-col gap-6">
          <Step n={1} title="Generate an authorization token">
            <TokenManager
              kind="revenuecat"
              label="Authorization header value"
              hint={status.tokenHint}
              token={token}
              onToken={onToken}
              canManage={canManage}
            />
            <p className="caption-style text-subtle">
              The token identifies this workspace, so every event it signs lands
              here. Each workspace has its own token.
            </p>
          </Step>
          <Step n={2} title="Add a webhook in RevenueCat">
            <p className="text-soft">
              In RevenueCat open your project → Integrations → Webhooks → Add
              new configuration. Paste the URL and the token above as the
              Authorization header value (with or without a “Bearer ” prefix).
            </p>
            <CopyField label="Webhook URL" value={url} />
            <p className="caption-style text-subtle">
              Revenue is linked to an app through the install record. With
              several apps, append{" "}
              <code className="font-mono">?app=&lt;bundle id&gt;</code> to the
              URL to pin every event to one app.
            </p>
          </Step>
          <Step n={3} title="Tag subscribers with the Open ASO user id">
            <p className="text-soft">
              This joins purchases back to the install, its country and its
              Apple Ads keyword.
            </p>
            <CodeBlock
              title="Swift"
              language="swift"
              code={`Purchases.shared.attribution.setAttributes(["openAsoId": OpenASO.userId])`}
            />
            <p className="caption-style text-subtle">
              Alternatively configure RevenueCat with the same app user id that
              you send to /api/attribution/install.
            </p>
          </Step>
          <Step n={4} title="Send a test event">
            <p className="text-soft">
              Use “Send test event” on the webhook page in RevenueCat. It shows
              up below as “Test event received” and is not counted as revenue.
            </p>
          </Step>
        </ol>
      </Section>
      <Section
        title={`Recent events · ${status.events} stored${status.lastEvent ? ` · last ${timeAgo(status.lastEvent.receivedAt)}` : ""}`}
      >
        <EventLog provider="revenuecat" />
      </Section>
    </div>
  );
}
