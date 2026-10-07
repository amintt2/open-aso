"use client";

import { Section } from "@/components/integrations/shared";
import { useApi } from "@/lib/client/api";
import type { PosthogStatus } from "@/lib/posthog/types";
import AppMapping from "./app-mapping";
import ConnectionSection from "./connection-section";
import EventMapping from "./event-mapping";

export default function PosthogPanel() {
  const { data: status } = useApi<PosthogStatus>("/api/posthog/status");
  if (!status) return <p className="caption-style text-subtle">Loading…</p>;
  return (
    <div className="flex flex-col gap-8">
      <Section title="Connection">
        <p className="text-soft">
          Open ASO reads your PostHog events with HogQL through the Query API. Everything is fetched on demand from this machine and cached for 10 minutes to stay under PostHog&apos;s query rate limits.
        </p>
        <ConnectionSection key={`${status.host}-${status.projectId}`} status={status} />
      </Section>
      {status.configured && (
        <>
          <Section title="Apps">
            <p className="text-soft">
              One PostHog project can hold all your apps. Each tracked app is matched by its bundle id ($app_namespace, set by posthog-ios and posthog-react-native) or, failing that, by the prefix of its custom events (tappy.first_open → tappy).
            </p>
            <AppMapping />
          </Section>
          <Section title="Events">
            <EventMapping />
          </Section>
        </>
      )}
    </div>
  );
}
