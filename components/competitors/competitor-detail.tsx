"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, KeyRound, Loader2, Swords, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import Button from "@/components/_ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/_ui/sheet";
import AppIcon from "@/components/shell/app-icon";
import CountrySelect from "@/components/shell/country-select";
import EmptyState from "@/components/shell/empty-state";
import PageHeader from "@/components/shell/page-header";
import AppProfile from "@/components/explore/app-profile";
import RankingKeywordsTable from "@/components/explore/ranking-keywords-table";
import { useAppCountry, useCurrentApp } from "@/hooks/use-app";
import { api, revalidate, useApi } from "@/lib/client/api";
import type { Competitor } from "@/lib/competitors/types";
import KeywordComparison from "./keyword-comparison";
import RemoveCompetitorDialog from "./remove-competitor-dialog";

export default function CompetitorDetail({ competitorId }: { competitorId: number }) {
  const router = useRouter();
  const { appId, app } = useCurrentApp();
  const [country, setCountry] = useAppCountry(app);
  const [trackOpen, setTrackOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const { data: competitor, error, isLoading } = useApi<Competitor>(app ? `/api/competitors/${competitorId}?country=${country}` : null);

  async function remove() {
    try {
      await api(`/api/competitors/${competitorId}`, { method: "DELETE" });
      await revalidate(`/api/apps/${appId}/competitors`);
      toast.success(`${competitor?.name ?? "Competitor"} removed`);
      router.push(`/apps/${appId}/competitors`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove competitor");
    }
  }

  const back = (
    <Button variant="ghost" size="icon-sm" href={`/apps/${appId}/competitors`} aria-label="Back to competitors">
      <ArrowLeft aria-hidden className="size-4" />
    </Button>
  );

  if (error || (competitor && competitor.appId !== appId))
    return (
      <>
        <PageHeader title={<span className="flex items-center gap-2">{back}Competitor</span>} />
        <EmptyState icon={Swords} title="Competitor not found" description="It may have been removed." action={<Button variant="secondary" size="md" href={`/apps/${appId}/competitors`}>Back to competitors</Button>} />
      </>
    );

  if (isLoading || !competitor || !app)
    return (
      <>
        <PageHeader title={<span className="flex items-center gap-2">{back}Competitor</span>} />
        <div role="status" className="text-subtle flex items-center justify-center gap-2 py-20">
          <Loader2 aria-hidden className="size-4 animate-spin" /> Loading competitor…
        </div>
      </>
    );

  return (
    <>
      <PageHeader
        title={
          <span className="flex min-w-0 items-center gap-2">
            {back}
            <AppIcon src={competitor.iconUrl} name={competitor.name} className="size-6" />
            <span className="truncate">{competitor.name}</span>
          </span>
        }
        actions={
          <>
            <CountrySelect value={country} onChange={setCountry} />
            <Button variant="secondary" size="md" onClick={() => setTrackOpen(true)}>
              <KeyRound aria-hidden className="size-3.5" />
              Track their keywords
            </Button>
            <Button variant="ghost" size="icon" aria-label="Remove competitor" onClick={() => setRemoveOpen(true)}>
              <Trash2 aria-hidden className="size-4" />
            </Button>
          </>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <AppProfile
          key={competitor.trackId}
          trackId={competitor.trackId}
          country={country}
          onCountryChange={setCountry}
          targetAppId={appId}
          targetAppName={app.name}
          excludeTrackIds={[competitor.trackId]}
          extraTabs={[
            {
              value: "comparison",
              label: "Keyword comparison",
              content: <KeywordComparison competitorId={competitorId} appId={appId} country={country} name={competitor.name} onTrackKeywords={() => setTrackOpen(true)} />,
            },
          ]}
        />
      </div>
      <Sheet open={trackOpen} onOpenChange={setTrackOpen}>
        <SheetContent side="right" className="w-full sm:max-w-[760px]">
          <SheetHeader>
            <SheetTitle>Track {competitor.name}&apos;s keywords</SheetTitle>
            <SheetClose asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Close">
                <X aria-hidden className="size-4" />
              </Button>
            </SheetClose>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <SheetDescription className="px-4 pt-4">Keywords {competitor.name} ranks for in this storefront. Select the ones to add to {app.name}.</SheetDescription>
            {trackOpen && <RankingKeywordsTable trackId={competitor.trackId} country={country} targetAppId={appId} targetAppName={app.name} />}
          </div>
        </SheetContent>
      </Sheet>
      <RemoveCompetitorDialog competitor={removeOpen ? competitor : null} onOpenChange={setRemoveOpen} onConfirm={remove} />
    </>
  );
}
