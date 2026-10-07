import { z } from "zod";
import { COUNTRIES, isCountry } from "@/lib/appstore/countries";
import type { StoreApp } from "@/lib/appstore/itunes";
import { getApp } from "@/lib/aso/apps";
import type { TrackedKeyword } from "@/lib/aso/keywords";
import { marketSize } from "@/lib/aso/scoring";
import { HttpError } from "@/lib/server/http";
import { publicJob, type JobState } from "@/lib/suggestions/jobs";
import { writesAllowed } from "../config";

export const appId = z.number().int().positive().describe("Open ASO app id from list_apps (not the App Store trackId)");
export const trackId = z.number().int().positive().describe("Numeric App Store id (trackId), e.g. 389801252");
export const country = z
  .string()
  .trim()
  .toLowerCase()
  .refine(isCountry, "Unsupported storefront country code")
  .describe("Two-letter App Store storefront code, e.g. us, gb, de, jp");
export const optionalCountry = country.optional().describe("Two-letter storefront code. Defaults to the app's primary country.");
export const limit = (fallback: number, max: number) => z.number().int().min(1).max(max).default(fallback).describe(`Maximum rows to return (default ${fallback}, max ${max})`);
export const dryRun = z.boolean().default(true).describe("Preview only (default true). Set false together with confirm: true to apply.");
export const confirm = z.boolean().default(false).describe("Must be true to apply a change when dryRun is false.");

export async function countryFor(workspaceId: string, id: number, value: string | undefined) {
  const app = await getApp(workspaceId, id);
  return value ?? app.primaryCountry;
}

export function topMarkets(n: number) {
  return COUNTRIES.map((c) => c.code)
    .sort((a, b) => marketSize(b) - marketSize(a))
    .slice(0, n);
}

export async function requireWrites(workspaceId: string) {
  if (!(await writesAllowed(workspaceId))) throw new HttpError(403, "Write tools are disabled. Ask a workspace admin to enable “Allow write tools” in Open ASO → MCP Server.");
}

export async function shouldApply(workspaceId: string, input: { dryRun: boolean; confirm: boolean }) {
  if (input.dryRun) return false;
  if (!input.confirm) throw new HttpError(400, "Refusing to apply: set confirm: true together with dryRun: false after reviewing the dry-run diff with the user.");
  await requireWrites(workspaceId);
  return true;
}

export function compactKeyword(k: TrackedKeyword) {
  return {
    id: k.id,
    term: k.term,
    country: k.country,
    popularity: k.popularity,
    popularitySource: k.popularitySource,
    difficulty: k.difficulty,
    opportunity: k.opportunity,
    position: k.position,
    positionChange: k.positionChange,
    label: k.label,
    downloadsEstimate: k.downloadsEst,
    resultsCount: k.resultsCount,
    liked: k.liked,
    notes: k.notes,
    topApps: k.topApps.slice(0, 3).map((a) => ({ position: a.position, trackId: a.trackId, name: a.name })),
    lastRefreshedAt: k.lastRefreshedAt,
    relevance: k.relevance,
    relevanceCategory: k.relevanceCategory,
    relevanceSource: k.relevanceSource,
    languageMatch: k.languageMatch,
  };
}

export function compactStoreApp(app: StoreApp, position?: number) {
  return {
    ...(position !== undefined ? { position } : {}),
    trackId: app.trackId,
    name: app.trackName,
    developer: app.sellerName,
    bundleId: app.bundleId,
    genre: app.primaryGenreName,
    rating: Math.round((app.averageUserRating ?? 0) * 100) / 100,
    ratingCount: app.userRatingCount,
    price: app.formattedPrice ?? app.price,
    version: app.version,
    updatedAt: app.currentVersionReleaseDate,
    releasedAt: app.releaseDate,
    url: app.trackViewUrl,
  };
}

export function truncate(text: string | undefined | null, max: number) {
  if (!text) return text ?? null;
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export async function waitForJob<T>(job: JobState<T>, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (job.status === "running" && Date.now() < deadline) await new Promise((r) => setTimeout(r, 500));
  if (job.status === "error") throw new HttpError(500, job.error ?? "Job failed");
  return job.status === "done" ? { done: true as const, result: job.result as T } : { done: false as const, job: { ...publicJob(job), result: undefined, partial: undefined } };
}

export const ESTIMATE_NOTE = "Downloads, revenue and popularity are modeled estimates, not Apple data.";
