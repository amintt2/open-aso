"use client";

import { Activity } from "lucide-react";
import IntegrationDetailSheet from "@/components/integrations/integration-detail-sheet";
import type { CardState } from "@/components/integrations/shared";
import type { PosthogStatus } from "@/lib/posthog/types";
import PosthogPanel from "./posthog-panel";

export const POSTHOG_DESCRIPTION =
  "Product analytics from your PostHog project: funnels, retention, experiments.";

export function PosthogGlyph() {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-(--tag-orange-bg) text-(--tag-orange-text)">
      <Activity aria-hidden className="size-5" />
    </span>
  );
}

export function posthogCardState(status: PosthogStatus | undefined): {
  state: CardState;
  label?: string;
  detail: string;
} {
  if (!status) return { state: "loading", detail: "" };
  if (!status.configured) return { state: "off", detail: "Not set up" };
  const where = `Project ${status.projectId} · ${status.region === "custom" ? (status.host ?? "self-hosted") : `${status.region?.toUpperCase()} Cloud`}`;
  if (!status.mappedApps)
    return { state: "waiting", label: "Map your apps", detail: where };
  return {
    state: "connected",
    detail: `${where} · ${status.mappedApps} app${status.mappedApps === 1 ? "" : "s"} mapped`,
  };
}

export default function PosthogSheet({
  open,
  onOpenChange,
  status,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: PosthogStatus | undefined;
}) {
  const card = posthogCardState(status);
  return (
    <IntegrationDetailSheet
      open={open}
      onOpenChange={onOpenChange}
      title="PostHog"
      description={POSTHOG_DESCRIPTION}
      icon={<PosthogGlyph />}
      state={card.state}
      stateLabel={card.label}
    >
      <PosthogPanel />
    </IntegrationDetailSheet>
  );
}
