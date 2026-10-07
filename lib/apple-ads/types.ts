export type CampaignStatus = "ENABLED" | "PAUSED";
export type KeywordStatus = "ACTIVE" | "PAUSED";
export type MatchType = "EXACT" | "BROAD";
export type AdGroupKind = "exact" | "broad" | "search_match" | "mixed" | "empty";
export type RangeDays = 7 | 14 | 30 | 90;

export type Metrics = {
  impressions: number;
  taps: number;
  installs: number;
  newDownloads: number;
  redownloads: number;
  spend: number;
  ttr: number | null;
  cr: number | null;
  cpt: number | null;
  cpa: number | null;
};

export type Attribution = {
  installs: number;
  revenue: number;
  rpi: number | null;
  roas: number | null;
};

export type ImpressionShare = { low: number; high: number; rank: string | null };

export type DiagnosisAction = "raise" | "lower" | "hold" | "pause" | "wait" | "review";

export type Diagnosis = {
  action: DiagnosisAction;
  rule: string;
  why: string;
};

export type BidSuggestion = {
  keywordId: string;
  campaignId: string;
  adGroupId: string;
  text: string;
  current: number;
  suggested: number;
  changePct: number;
  rule: string;
  why: string;
  capped: boolean;
};

export type BudgetSuggestion = {
  campaignId: string;
  name: string;
  current: number;
  suggested: number;
  changePct: number;
  rule: string;
  why: string;
  capped: boolean;
};

export type AdsOrg = {
  orgId: string;
  orgName: string;
  currency: string;
  timeZone: string | null;
  paymentModel: string | null;
  roleNames: string[];
};

export type AdsConnection = {
  configured: boolean;
  connected: boolean;
  clientId: string | null;
  teamId: string | null;
  keyId: string | null;
  orgId: string | null;
  orgName: string | null;
  currency: string;
  publicKey: string | null;
  hasPrivateKey: boolean;
  lastError: string | null;
  lastCheckedAt: string | null;
};

export type AdsCampaign = {
  id: string;
  name: string;
  status: CampaignStatus;
  servingStatus: string | null;
  displayStatus: string | null;
  servingStateReasons: string[];
  adamId: number;
  countries: string[];
  dailyBudget: number | null;
  currency: string;
  supplySources: string[];
  biddingStrategy: string | null;
  metrics: Metrics;
  attribution: Attribution | null;
  budgetUtilization: number | null;
};

export type AdsAdGroup = {
  id: string;
  campaignId: string;
  name: string;
  status: CampaignStatus;
  displayStatus: string | null;
  defaultBid: number;
  cpaGoal: number | null;
  searchMatch: boolean;
  kind: AdGroupKind;
  keywordCount: number;
  metrics: Metrics;
  attribution: Attribution | null;
};

export type AdsKeyword = {
  id: string;
  campaignId: string;
  adGroupId: string;
  text: string;
  matchType: MatchType;
  status: KeywordStatus;
  displayStatus: string | null;
  bid: number;
  bidIsDefault: boolean;
  suggestedBid: number | null;
  impressionShare: ImpressionShare | null;
  metrics: Metrics;
  attribution: Attribution | null;
  diagnosis: Diagnosis;
  suggestion: BidSuggestion | null;
};

export type AdsNegative = {
  id: string;
  campaignId: string;
  adGroupId: string | null;
  text: string;
  matchType: MatchType;
  status: string;
};

export type DailyPoint = {
  date: string;
  spend: number;
  impressions: number;
  taps: number;
  installs: number;
};

export type CountryPoint = {
  country: string;
  spend: number;
  installs: number;
  impressions: number;
  taps: number;
};

export type CannibalizationIssue = {
  id: string;
  term: string;
  country: string;
  adamId: number;
  exact: { campaignId: string; campaignName: string; adGroupId: string; adGroupName: string; keywordId: string };
  target: { campaignId: string; campaignName: string; adGroupId: string; adGroupName: string; reason: string };
};

export type DiffRow = {
  entity: string;
  field: string;
  before: string | null;
  after: string;
  warning?: string;
};

export type ChangeResult = {
  dryRun: boolean;
  demo: boolean;
  changes: DiffRow[];
  warnings: string[];
  results: { entity: string; ok: boolean; error?: string }[];
};

export type AdsSnapshot = {
  orgId: string;
  currency: string;
  days: RangeDays;
  startDate: string;
  endDate: string;
  campaigns: AdsCampaign[];
  adGroups: AdsAdGroup[];
  keywords: AdsKeyword[];
  negatives: AdsNegative[];
  daily: DailyPoint[];
  countries: CountryPoint[];
  generatedAt: string;
  demo: boolean;
  warnings: string[];
};

export type AdsDashboard = {
  demo: boolean;
  currency: string;
  days: RangeDays;
  startDate: string;
  endDate: string;
  totals: Metrics;
  previousTotals: Metrics | null;
  attribution: Attribution | null;
  daily: DailyPoint[];
  countries: CountryPoint[];
  campaigns: AdsCampaign[];
  bidSuggestions: BidSuggestion[];
  budgetSuggestions: BudgetSuggestion[];
  cannibalization: CannibalizationIssue[];
  targetCpa: number | null;
  generatedAt: string;
  warnings: string[];
};

export type CampaignDetail = {
  campaign: AdsCampaign;
  adGroups: AdsAdGroup[];
  negatives: AdsNegative[];
  demo: boolean;
};

export type AdGroupDetail = {
  campaign: AdsCampaign;
  adGroup: AdsAdGroup;
  keywords: AdsKeyword[];
  negatives: AdsNegative[];
  campaignNegatives: AdsNegative[];
  demo: boolean;
};

export type KeywordTrend = {
  keywordId: string;
  keyword: string;
  currency: string;
  points: (DailyPoint & { cpa: number | null; cpt: number | null })[];
  demo: boolean;
};

export type CampaignPlanInput = {
  adamId: number;
  appName: string;
  countries: string[];
  dailyBudget: number;
  defaultBid: number;
  matchType: MatchType | "SEARCH_MATCH";
  namePattern: string;
  keywords: { text: string; bid?: number | null }[];
  negatives?: string[];
  status?: CampaignStatus;
};

export type PlannedCampaign = {
  name: string;
  country: string;
  adamId: number;
  dailyBudget: number;
  currency: string;
  supplySource: "APPSTORE_SEARCH_RESULTS";
  status: CampaignStatus;
  adGroup: {
    name: string;
    defaultBid: number;
    searchMatch: boolean;
    keywords: { text: string; matchType: MatchType; bid: number }[];
    negatives: { text: string; matchType: MatchType }[];
  };
};

export type CampaignPlan = {
  campaigns: PlannedCampaign[];
  warnings: string[];
};

export type AdGroupPlanInput = {
  campaignId: string;
  name: string;
  defaultBid: number;
  searchMatch: boolean;
  matchType: MatchType;
  keywords: { text: string; bid?: number | null }[];
  status?: CampaignStatus;
};

export type BidChange = { campaignId: string; adGroupId: string; keywordId: string; bid: number };
export type BudgetChange = { campaignId: string; dailyBudget: number };
export type AdGroupBidChange = { campaignId: string; adGroupId: string; defaultBid: number };
export type EntityStatusChange =
  | { type: "campaign"; campaignId: string; status: CampaignStatus }
  | { type: "adgroup"; campaignId: string; adGroupId: string; status: CampaignStatus }
  | { type: "keyword"; campaignId: string; adGroupId: string; keywordId: string; status: KeywordStatus };

export type KeywordInput = { text: string; matchType?: MatchType; bid?: number | null };
export type NegativeInput = { text: string; matchType?: MatchType };

export const RANGE_OPTIONS: RangeDays[] = [7, 14, 30, 90];

export function emptyMetrics(): Metrics {
  return { impressions: 0, taps: 0, installs: 0, newDownloads: 0, redownloads: 0, spend: 0, ttr: null, cr: null, cpt: null, cpa: null };
}
