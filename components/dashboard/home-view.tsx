"use client";

import { Plus } from "lucide-react";
import Button from "@/components/_ui/button";
import { AddToClaudeButton, ClaudeConnectBanner, useClaudeConnect } from "@/components/mcp/claude-connect";
import type { HomeClaude } from "@/components/mcp/types";
import PageHeader from "@/components/shell/page-header";
import { useApi } from "@/lib/client/api";
import type { MoversResult } from "@/lib/dashboard/types";
import { useUiStore } from "@/stores/ui-store";
import { AlertsList, QuickActions } from "./alerts-actions";
import AppsTable from "./apps-table";
import MoversList from "./movers-list";
import { SectionTitle } from "./parts";
import { Card, SkeletonRows, WidgetError } from "./widget";

function Movers() {
  const { data, error } = useApi<MoversResult>("/api/dashboard/movers");
  return (
    <Card
      title="Top movers"
      description="Biggest rank changes across all apps over 7 days."
    >
      {error && !data ? (
        <WidgetError message={error.message} />
      ) : !data ? (
        <SkeletonRows rows={6} />
      ) : (
        <MoversList
          gainers={data.gainers}
          losers={data.losers}
          hrefFor={(m) => `/apps/${m.appId}/trends`}
        />
      )}
    </Card>
  );
}

export default function HomeView({ claude }: { claude: HomeClaude }) {
  const setAddAppOpen = useUiStore((s) => s.setAddAppOpen);
  const { onOpen } = useClaudeConnect(claude);
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="One row per app: real downloads, first opens and revenue next to where its keywords rank."
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setAddAppOpen(true)}
            >
              <Plus aria-hidden className="size-3.5" />
              Add app
            </Button>
            {claude.connected && (
              <AddToClaudeButton
                href={claude.claudeUrl}
                size="sm"
                onOpen={onOpen}
              />
            )}
          </>
        }
      />
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 p-4">
        {!claude.connected && <ClaudeConnectBanner claude={claude} />}
        <SectionTitle>Apps compared · last 7 days</SectionTitle>
        <AppsTable />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <Movers />
          <Card
            title="Alerts"
            description="Ranking drops, stale data and integration errors."
          >
            <AlertsList />
          </Card>
          <Card title="Quick actions" className="xl:self-start">
            <QuickActions />
          </Card>
        </div>
      </div>
    </>
  );
}
