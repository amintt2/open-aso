import { adsRequest, listAll, type Envelope } from "./client";
import type { AdsOrg, CampaignStatus, KeywordStatus, MatchType } from "./types";

export type RawMoney = { amount: string; currency: string } | null | undefined;

export type RawCampaign = {
  id: number;
  orgId: number;
  name: string;
  adamId: number;
  status: CampaignStatus;
  servingStatus?: string | null;
  displayStatus?: string | null;
  servingStateReasons?: string[] | null;
  countriesOrRegions?: string[];
  dailyBudgetAmount?: RawMoney;
  budgetAmount?: RawMoney;
  supplySources?: string[];
  adChannelType?: string;
  billingEvent?: string;
  biddingStrategy?: string | null;
  deleted?: boolean;
};

export type RawAdGroup = {
  id: number;
  campaignId: number;
  name: string;
  status: CampaignStatus;
  displayStatus?: string | null;
  servingStatus?: string | null;
  defaultBidAmount?: RawMoney;
  cpaGoal?: RawMoney;
  automatedKeywordsOptIn?: boolean;
  deleted?: boolean;
};

export type RawKeyword = {
  id: number;
  adGroupId: number;
  text: string;
  status: KeywordStatus;
  matchType: MatchType;
  bidAmount?: RawMoney;
  deleted?: boolean;
};

export type RawNegative = {
  id: number;
  campaignId?: number;
  adGroupId?: number | null;
  text: string;
  matchType: MatchType;
  status?: string;
  deleted?: boolean;
};

type RawAcl = {
  orgId: number | string;
  orgName: string;
  currency: string;
  timeZone?: string;
  paymentModel?: string;
  roleNames?: string[];
};

export function amount(m: RawMoney): number | null {
  if (!m || m.amount == null || m.amount === "null") return null;
  const n = Number(m.amount);
  return Number.isFinite(n) ? n : null;
}

export function money(value: number, currency: string) {
  return { amount: (Math.round(value * 100) / 100).toFixed(2), currency };
}

export async function listOrgs(): Promise<AdsOrg[]> {
  const res = await adsRequest<Envelope<RawAcl[] | RawAcl>>("GET", "/acls", { orgScoped: false });
  const list = Array.isArray(res.data) ? res.data : res.data ? [res.data] : [];
  return list.map((a) => ({
    orgId: String(a.orgId),
    orgName: a.orgName,
    currency: a.currency,
    timeZone: a.timeZone ?? null,
    paymentModel: a.paymentModel ?? null,
    roleNames: a.roleNames ?? [],
  }));
}

export async function fetchCampaigns() {
  return (await listAll<RawCampaign>("/campaigns")).filter((c) => !c.deleted);
}

export async function fetchAdGroups(campaignId: string) {
  return (await listAll<RawAdGroup>(`/campaigns/${campaignId}/adgroups`)).filter((g) => !g.deleted);
}

export async function fetchTargetingKeywords(campaignId: string, adGroupId: string) {
  return (await listAll<RawKeyword>(`/campaigns/${campaignId}/adgroups/${adGroupId}/targetingkeywords`)).filter((k) => !k.deleted);
}

export async function fetchCampaignNegatives(campaignId: string) {
  return (await listAll<RawNegative>(`/campaigns/${campaignId}/negativekeywords`)).filter((k) => !k.deleted);
}

export async function fetchAdGroupNegatives(campaignId: string, adGroupId: string) {
  return (await listAll<RawNegative>(`/campaigns/${campaignId}/adgroups/${adGroupId}/negativekeywords`)).filter((k) => !k.deleted);
}

export async function postCampaign(body: {
  orgId: number;
  name: string;
  adamId: number;
  countriesOrRegions: string[];
  dailyBudgetAmount: { amount: string; currency: string };
  supplySources: string[];
  adChannelType: "SEARCH";
  billingEvent: "TAPS";
  status: CampaignStatus;
}) {
  return (await adsRequest<Envelope<RawCampaign>>("POST", "/campaigns", { body })).data;
}

export async function putCampaign(campaignId: string, campaign: { status?: CampaignStatus; dailyBudgetAmount?: { amount: string; currency: string }; name?: string }) {
  return (await adsRequest<Envelope<RawCampaign>>("PUT", `/campaigns/${campaignId}`, { body: { campaign } })).data;
}

export async function postAdGroup(
  campaignId: string,
  body: {
    name: string;
    pricingModel: "CPC";
    defaultBidAmount: { amount: string; currency: string };
    automatedKeywordsOptIn: boolean;
    startTime: string;
    status: CampaignStatus;
  },
) {
  return (await adsRequest<Envelope<RawAdGroup>>("POST", `/campaigns/${campaignId}/adgroups`, { body })).data;
}

export async function putAdGroup(
  campaignId: string,
  adGroupId: string,
  body: { status?: CampaignStatus; defaultBidAmount?: { amount: string; currency: string }; automatedKeywordsOptIn?: boolean; name?: string },
) {
  return (await adsRequest<Envelope<RawAdGroup>>("PUT", `/campaigns/${campaignId}/adgroups/${adGroupId}`, { body })).data;
}

export async function postKeywords(campaignId: string, adGroupId: string, keywords: { text: string; matchType: MatchType; bidAmount?: { amount: string; currency: string }; status?: KeywordStatus }[]) {
  return (await adsRequest<Envelope<RawKeyword[]>>("POST", `/campaigns/${campaignId}/adgroups/${adGroupId}/targetingkeywords/bulk`, { body: keywords })).data;
}

export async function putKeywords(campaignId: string, adGroupId: string, updates: { id: number; bidAmount?: { amount: string; currency: string }; status?: KeywordStatus }[]) {
  return (await adsRequest<Envelope<RawKeyword[]>>("PUT", `/campaigns/${campaignId}/adgroups/${adGroupId}/targetingkeywords/bulk`, { body: updates })).data;
}

export async function postCampaignNegatives(campaignId: string, negatives: { text: string; matchType: MatchType }[]) {
  return (await adsRequest<Envelope<RawNegative[]>>("POST", `/campaigns/${campaignId}/negativekeywords/bulk`, { body: negatives })).data;
}

export async function postAdGroupNegatives(campaignId: string, adGroupId: string, negatives: { text: string; matchType: MatchType }[]) {
  return (await adsRequest<Envelope<RawNegative[]>>("POST", `/campaigns/${campaignId}/adgroups/${adGroupId}/negativekeywords/bulk`, { body: negatives })).data;
}
