import { create } from "zustand";
import type { AdsKeyword, RangeDays } from "@/lib/apple-ads/types";

type AdGroupRef = { campaignId: string; adGroupId: string };

export type AdsSheet = "connect" | "map" | "playbook" | "createCampaign" | "cannibalization" | null;

type AdsUiState = {
  demo: boolean;
  days: RangeDays;
  sheet: AdsSheet;
  campaignId: string | null;
  adGroup: AdGroupRef | null;
  trend: AdsKeyword | null;
  createAdGroupFor: string | null;
  addKeywordsTo: AdGroupRef | null;
  addNegativesTo: { campaignId: string; adGroupId: string | null } | null;
  setDemo: (demo: boolean) => void;
  setDays: (days: RangeDays) => void;
  openSheet: (sheet: AdsSheet) => void;
  openCampaign: (id: string | null) => void;
  openAdGroup: (ref: AdGroupRef | null) => void;
  openTrend: (k: AdsKeyword | null) => void;
  openCreateAdGroup: (campaignId: string | null) => void;
  openAddKeywords: (ref: AdGroupRef | null) => void;
  openAddNegatives: (ref: { campaignId: string; adGroupId: string | null } | null) => void;
};

export const useAdsUi = create<AdsUiState>()((set) => ({
  demo: false,
  days: 30,
  sheet: null,
  campaignId: null,
  adGroup: null,
  trend: null,
  createAdGroupFor: null,
  addKeywordsTo: null,
  addNegativesTo: null,
  setDemo: (demo) => set({ demo, campaignId: null, adGroup: null, trend: null }),
  setDays: (days) => set({ days }),
  openSheet: (sheet) => set({ sheet }),
  openCampaign: (campaignId) => set({ campaignId }),
  openAdGroup: (adGroup) => set({ adGroup }),
  openTrend: (trend) => set({ trend }),
  openCreateAdGroup: (createAdGroupFor) => set({ createAdGroupFor }),
  openAddKeywords: (addKeywordsTo) => set({ addKeywordsTo }),
  openAddNegatives: (addNegativesTo) => set({ addNegativesTo }),
}));

export function useAdsQuery() {
  const demo = useAdsUi((s) => s.demo);
  const days = useAdsUi((s) => s.days);
  return `days=${days}${demo ? "&demo=1" : ""}`;
}
