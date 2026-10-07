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

export async function listOrgs(workspaceId: string): Promise<AdsOrg[]> {
  const res = await adsRequest<Envelope<RawAcl[] | RawAcl>>(workspaceId, "GET", "/acls", { orgScoped: false });
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

export async function fetchCampaigns(workspaceId: string) {
  return (await listAll<RawCampaign>(workspaceId, "/campaigns")).filter((c) => !c.deleted);
}

export async function fetchAdGroups(workspaceId: string, campaignId: string) {
  return (await listAll<RawAdGroup>(workspaceId, `/campaigns/${campaignId}/adgroups`)).filter((g) => !g.deleted);
}

export async function fetchTargetingKeywords(workspaceId: string, campaignId: string, adGroupId: string) {
  return (await listAll<RawKeyword>(workspaceId, `/campaigns/${campaignId}/adgroups/${adGroupId}/targetingkeywords`)).filter((k) => !k.deleted);
}

export async function fetchCampaignNegatives(workspaceId: string, campaignId: string) {
  return (await listAll<RawNegative>(workspaceId, `/campaigns/${campaignId}/negativekeywords`)).filter((k) => !k.deleted);
}

export async function fetchAdGroupNegatives(workspaceId: string, campaignId: string, adGroupId: string) {
  return (await listAll<RawNegative>(workspaceId, `/campaigns/${campaignId}/adgroups/${adGroupId}/negativekeywords`)).filter((k) => !k.deleted);
}

export async function postCampaign(workspaceId: string, body: {
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
  return (await adsRequest<Envelope<RawCampaign>>(workspaceId, "POST", "/campaigns", { body })).data;
}

export async function putCampaign(workspaceId: string, campaignId: string, campaign: { status?: CampaignStatus; dailyBudgetAmount?: { amount: string; currency: string }; name?: string }) {
  return (await adsRequest<Envelope<RawCampaign>>(workspaceId, "PUT", `/campaigns/${campaignId}`, { body: { campaign } })).data;
}

export async function postAdGroup(
  workspaceId: string,
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
  return (await adsRequest<Envelope<RawAdGroup>>(workspaceId, "POST", `/campaigns/${campaignId}/adgroups`, { body })).data;
}

export async function putAdGroup(
  workspaceId: string,
  campaignId: string,
  adGroupId: string,
  body: { status?: CampaignStatus; defaultBidAmount?: { amount: string; currency: string }; automatedKeywordsOptIn?: boolean; name?: string },
) {
  return (await adsRequest<Envelope<RawAdGroup>>(workspaceId, "PUT", `/campaigns/${campaignId}/adgroups/${adGroupId}`, { body })).data;
}

export async function postKeywords(workspaceId: string, campaignId: string, adGroupId: string, keywords: { text: string; matchType: MatchType; bidAmount?: { amount: string; currency: string }; status?: KeywordStatus }[]) {
  return (await adsRequest<Envelope<RawKeyword[]>>(workspaceId, "POST", `/campaigns/${campaignId}/adgroups/${adGroupId}/targetingkeywords/bulk`, { body: keywords })).data;
}

export async function putKeywords(workspaceId: string, campaignId: string, adGroupId: string, updates: { id: number; bidAmount?: { amount: string; currency: string }; status?: KeywordStatus }[]) {
  return (await adsRequest<Envelope<RawKeyword[]>>(workspaceId, "PUT", `/campaigns/${campaignId}/adgroups/${adGroupId}/targetingkeywords/bulk`, { body: updates })).data;
}

export async function postCampaignNegatives(workspaceId: string, campaignId: string, negatives: { text: string; matchType: MatchType }[]) {
  return (await adsRequest<Envelope<RawNegative[]>>(workspaceId, "POST", `/campaigns/${campaignId}/negativekeywords/bulk`, { body: negatives })).data;
}

export async function postAdGroupNegatives(workspaceId: string, campaignId: string, adGroupId: string, negatives: { text: string; matchType: MatchType }[]) {
  return (await adsRequest<Envelope<RawNegative[]>>(workspaceId, "POST", `/campaigns/${campaignId}/adgroups/${adGroupId}/negativekeywords/bulk`, { body: negatives })).data;
}
