"use client";

import { Sparkles, Plus } from "lucide-react";
import Button from "@/components/_ui/button";
import { ClaudeConnectBanner } from "@/components/mcp/claude-connect";
import type { HomeClaude } from "@/components/mcp/types";
import EmptyState from "./empty-state";
import PageHeader from "./page-header";
import { useUiStore } from "@/stores/ui-store";

export default function Welcome({ claude }: { claude: HomeClaude }) {
  const setAddAppOpen = useUiStore((s) => s.setAddAppOpen);
  return (
    <>
      <PageHeader title="Welcome" />
      <EmptyState
        icon={Sparkles}
        title="Track your first app"
        description="Add an app from the App Store to research keywords, track rankings, watch competitors and find country opportunities. Everyone in this workspace sees the same apps and data."
        action={
          <Button variant="primary" size="md" onClick={() => setAddAppOpen(true)}>
            <Plus aria-hidden className="size-3.5" />
            Add app
          </Button>
        }
      />
      <div className="mx-auto w-full max-w-[960px] px-4 pb-6">
        <ClaudeConnectBanner claude={claude} />
      </div>
    </>
  );
}
