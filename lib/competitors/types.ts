export type Competitor = {
  id: number;
  appId: number;
  trackId: number;
  name: string;
  iconUrl: string | null;
  developer: string | null;
  country: string;
  createdAt: string;
  rating: number | null;
  ratingCount: number | null;
  price: number | null;
  genre: string | null;
  version: string | null;
  updatedAt: string | null;
  storeUrl: string | null;
  downloadsEst: number | null;
  revenueEst: number | null;
  outranksMe: number;
  sharedKeywords: number;
};

export type ComparisonRow = {
  keywordId: number;
  term: string;
  popularity: number | null;
  difficulty: number | null;
  myPosition: number | null;
  theirPosition: number | null;
};

export type Comparison = {
  competitorId: number;
  country: string;
  rows: ComparisonRow[];
  theyLead: number;
  iLead: number;
  bothRank: number;
  onlyThey: number;
};

export type CompetitorSuggestion = {
  trackId: number;
  name: string;
  developer: string;
  iconUrl: string;
  rating: number;
  ratingCount: number;
  appearances: number;
  bestPosition: number;
  avgPosition: number;
  keywords: string[];
};
