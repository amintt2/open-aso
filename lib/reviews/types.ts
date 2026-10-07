import type { Review } from "@/lib/appstore/itunes";

export type CountryReview = Review & { country: string };

export type ReviewsResponse = {
  trackId: number;
  scope: string;
  countries: string[];
  reviews: CountryReview[];
  fetchedAt: string;
};

export type Theme = {
  phrase: string;
  count: number;
  share: number;
  avgRating: number;
};

export type SummaryPoint = {
  title: string;
  detail: string;
  mentions: number | null;
};

export type ReviewSummary = {
  overview: string;
  complaints: SummaryPoint[];
  requests: SummaryPoint[];
  praise: SummaryPoint[];
  reviewCount: number;
  model: string;
  generatedAt: string;
};

export const MAJOR_COUNTRIES = ["us", "gb", "ca", "au", "de", "fr", "jp", "br", "in", "es"];
