"use client";

import PageHeader from "@/components/shell/page-header";
import { ScrollArea } from "@/components/_ui/scroll-area";
import { useApi } from "@/lib/client/api";
import AiSettings, { type PublicSettings } from "./ai-settings";
import BrowserFetching from "./browser-fetching";
import DataSettings from "./data-settings";
import DangerZone from "./danger-zone";
import {
  PlanSettings,
  SchedulerSettings,
  type SystemInfo,
} from "./system-settings";

const SECTIONS = [
  { id: "plan", label: "Plan & usage" },
  { id: "ai", label: "AI" },
  { id: "scheduler", label: "Keyword refresh" },
  { id: "browser-fetching", label: "Browser fetching" },
  { id: "data", label: "Data" },
  { id: "danger", label: "Danger zone" },
];

export default function SettingsView() {
  const { data: settings, mutate } = useApi<PublicSettings>("/api/settings");
  const { data: info, mutate: refreshInfo } = useApi<SystemInfo>(
    "/api/integrations/system",
  );
  const canManage = !!info?.workspace.canManage;
  return (
    <>
      <PageHeader title="Settings" />
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto flex w-full max-w-[960px] flex-col gap-4 p-4">
          <nav aria-label="Settings sections" className="flex flex-wrap gap-1">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="caption-style text-subtle hover:text-foreground rounded-full px-2.5 py-1.5 transition-colors duration-150 hover:bg-white/6"
              >
                {s.label}
              </a>
            ))}
          </nav>
          <PlanSettings info={info} />
          <AiSettings
            settings={settings ?? {}}
            canManage={canManage}
            onChange={(next) => mutate(next, { revalidate: false })}
          />
          <SchedulerSettings info={info} />
          <BrowserFetching />
          <DataSettings canManage={canManage} onChanged={() => refreshInfo()} />
          <DangerZone canManage={canManage} />
        </div>
      </ScrollArea>
    </>
  );
}
