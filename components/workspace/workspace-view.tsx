"use client";

import { Loader2 } from "lucide-react";
import PageHeader from "@/components/shell/page-header";
import { ScrollArea } from "@/components/_ui/scroll-area";
import Tag from "@/components/_ui/tag";
import { revalidate, useApi } from "@/lib/client/api";
import { ROLE_LABEL, type WorkspaceDetails } from "@/lib/workspace/types";
import DangerCard from "./danger-card";
import GeneralCard from "./general-card";
import InvitesCard from "./invites-card";
import MembersCard from "./members-card";
import PlanCard from "./plan-card";

export default function WorkspaceView() {
  const { data, error, mutate } = useApi<WorkspaceDetails>("/api/workspace");
  const refresh = () => {
    void mutate();
    void revalidate("/api/workspace/me");
  };
  return (
    <>
      <PageHeader
        title={data?.name ?? "Workspace"}
        badge={data && <Tag size="sm">{ROLE_LABEL[data.role]}</Tag>}
      />
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto flex w-full max-w-[960px] flex-col gap-4 p-4">
          {error && <p className="text-danger">{error.message}</p>}
          {!data && !error && (
            <div className="text-subtle flex items-center gap-2 py-10">
              <Loader2 aria-hidden className="size-4 animate-spin" />
              Loading workspace…
            </div>
          )}
          {data && (
            <>
              <GeneralCard
                key={data.id + data.name}
                workspace={data}
                onChange={(next) => mutate(next, { revalidate: false })}
              />
              <PlanCard workspace={data} />
              <MembersCard workspace={data} onChanged={refresh} />
              {data.role !== "member" && (
                <InvitesCard workspace={data} onChanged={refresh} />
              )}
              <DangerCard workspace={data} />
            </>
          )}
        </div>
      </ScrollArea>
    </>
  );
}
