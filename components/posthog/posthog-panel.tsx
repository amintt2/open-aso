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
          Open ASO reads this workspace&apos;s PostHog project with HogQL
          through the Query API. Everything is fetched on demand and cached for
          10 minutes to stay under PostHog&apos;s query rate limits.
        </p>
        <ConnectionSection
          key={`${status.host}-${status.projectId}`}
          status={status}
        />
        {status.canManage === false && (
          <p className="caption-style text-subtle">
            Only workspace owners and admins can change the PostHog connection
            and mappings.
          </p>
        )}
      </Section>
      {status.configured && (
        <>
          <Section title="Apps">
            <p className="text-soft">
              One PostHog project can hold all your apps. Each tracked app is
              matched by its bundle id ($app_namespace, set by posthog-ios and
              posthog-react-native) or, failing that, by the prefix of its
              custom events (tappy.first_open → tappy).
            </p>
            <AppMapping canManage={status.canManage !== false} />
          </Section>
          <Section title="Events">
            <EventMapping canManage={status.canManage !== false} />
          </Section>
        </>
      )}
    </div>
  );
}
