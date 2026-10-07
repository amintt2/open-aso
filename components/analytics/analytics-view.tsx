"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import PageHeader from "@/components/shell/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/_ui/tabs";
import { ScrollArea } from "@/components/_ui/scroll-area";
import AnalyticsFilters from "./analytics-filters";
import OverviewTab from "./overview-tab";
import SourcesTab from "./sources-tab";
import GeographyTab from "./geography-tab";
import RetentionTab from "./retention-tab";
import KeywordRoasTab from "./keyword-roas-tab";
import ProductTab from "@/components/posthog/product-tab";
import type { AnalyticsFilterState } from "./use-analytics";

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "sources", label: "Sources" },
  { value: "geography", label: "Geography" },
  { value: "retention", label: "Retention" },
  { value: "keywords", label: "Keyword ROAS" },
  { value: "product", label: "Product (PostHog)" },
] as const;

type TabValue = (typeof TABS)[number]["value"];

export default function AnalyticsView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab = (TABS.find((t) => t.value === params.get("tab"))?.value ?? "overview") as TabValue;
  const days = [7, 30, 90].includes(Number(params.get("days"))) ? Number(params.get("days")) : 30;
  const filters: AnalyticsFilterState = { appId: params.get("app") ?? "all", days, sandbox: params.get("sandbox") === "1" };

  const update = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null) next.delete(key);
        else next.set(key, value);
      }
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  return (
    <Tabs value={tab} onValueChange={(value) => update({ tab: value === "overview" ? null : value })} className="min-h-0 flex-1">
      <PageHeader
        title="Analytics"
        actions={
          <AnalyticsFilters
            value={filters}
            onChange={(next) => update({ app: next.appId === "all" ? null : next.appId, days: next.days === 30 ? null : String(next.days), sandbox: next.sandbox ? "1" : null })}
          />
        }
      >
        <TabsList className="overflow-x-auto px-4">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="py-3">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </PageHeader>
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 p-4">
          <TabsContent value="overview">
            <OverviewTab filters={filters} />
          </TabsContent>
          <TabsContent value="sources">
            <SourcesTab filters={filters} />
          </TabsContent>
          <TabsContent value="geography">
            <GeographyTab filters={filters} />
          </TabsContent>
          <TabsContent value="retention">
            <RetentionTab filters={filters} />
          </TabsContent>
          <TabsContent value="keywords">
            <KeywordRoasTab filters={filters} />
          </TabsContent>
          <TabsContent value="product">
            <ProductTab filters={filters} onAppChange={(app) => update({ app })} />
          </TabsContent>
        </div>
      </ScrollArea>
    </Tabs>
  );
}
