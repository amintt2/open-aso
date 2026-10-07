import { fetchReviews, type Review } from "@/lib/appstore/itunes";
import { getCountry } from "@/lib/appstore/countries";
import { pool } from "@/lib/explore/pool";
import { MAJOR_COUNTRIES, type CountryReview, type ReviewsResponse } from "./types";

const PAGES = 10;
const PAGES_PER_COUNTRY_ALL = 4;

async function pagesFor(trackId: number, country: string, pages: number): Promise<CountryReview[]> {
  const list = await pool(
    Array.from({ length: pages }, (_, i) => i + 1),
    4,
    (page) => fetchReviews(trackId, country, page).catch(() => [] as Review[]),
  );
  return list.flat().map((r) => ({ ...r, country }));
}

export async function loadReviews(trackId: number, scope: string): Promise<ReviewsResponse> {
  const countries = scope === "all" ? MAJOR_COUNTRIES : [getCountry(scope).code];
  const pages = scope === "all" ? PAGES_PER_COUNTRY_ALL : PAGES;
  const batches = await pool(countries, 3, (c) => pagesFor(trackId, c, pages));
  const seen = new Set<string>();
  const reviews = batches
    .flat()
    .filter((r) => {
      const key = `${r.country}:${r.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime());
  return { trackId, scope, countries, reviews, fetchedAt: new Date().toISOString() };
}
