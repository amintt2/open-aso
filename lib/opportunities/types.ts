import type { TargetingLabel } from "@/lib/aso/scoring";

export type CountryOpportunity = {
  country: string;
  popularity: number;
  difficulty: number;
  opportunity: number;
  label: TargetingLabel;
  position: number | null;
  monthlySearches: number;
  downloadsEst: number;
  resultsCount: number;
  topApp: { trackId: number; name: string; iconUrl: string; developer: string } | null;
  error?: string;
};

export type OpportunityScan = {
  appId: number;
  term: string;
  countries: string[];
  scannedAt: string;
  results: CountryOpportunity[];
};
