import { z } from "zod";
import { lookupApp } from "@/lib/appstore/itunes";
import { findAppByTrackId, getApp } from "@/lib/aso/apps";
import { addKeywords, deleteKeywords, getKeyword, listKeywords, refreshKeywords, updateKeyword } from "@/lib/aso/keywords";
import { normalizeTerm } from "@/lib/aso/scoring";
import { sameLocale } from "@/lib/asc/locales";
import { getAppMetadata, getMetadata, updateMetadata } from "@/lib/asc/metadata";
import { getProductPrices, listProducts } from "@/lib/asc/pricing";
import { ALPHA3 } from "@/lib/asc/territories";
import { METADATA_LIMITS, type LocaleMetadata, type MetadataPatch, type TerritoryPrice } from "@/lib/asc/types";
import { HttpError } from "@/lib/server/http";
import { isStopword, tokenize } from "@/lib/suggestions/text";
import { defineTool } from "../define";
import { appId, compactKeyword, confirm, countryFor, dryRun, ESTIMATE_NOTE, optionalCountry, requireWrites, shouldApply, trackId, truncate } from "./shared";

const FIELD_MAP = { title: "name", subtitle: "subtitle", keywords: "keywords" } as const;
type EditableField = keyof typeof FIELD_MAP;

function chars(value: string | null | undefined) {
  return [...(value ?? "")].length;
}

function localeView(l: LocaleMetadata, includeDescription: boolean) {
  return {
    locale: l.locale,
    title: l.name,
    subtitle: l.subtitle,
    keywords: l.keywords,
    lengths: { title: chars(l.name), subtitle: chars(l.subtitle), keywords: chars(l.keywords) },
    promotionalText: l.promotionalText,
    whatsNew: includeDescription ? l.whatsNew : truncate(l.whatsNew, 300),
    ...(includeDescription ? { description: l.description } : {}),
  };
}

function keywordWarnings(next: { title: string | null; subtitle: string | null; keywords: string | null }) {
  const warnings: string[] = [];
  const keywords = next.keywords ?? "";
  if (/,\s/.test(keywords)) warnings.push("The keywords field has spaces after commas; Apple counts them toward the 100 characters.");
  const indexed = new Set([...tokenize(next.title ?? ""), ...tokenize(next.subtitle ?? "")]);
  const repeated = [...new Set(keywords.split(",").flatMap((k) => tokenize(k)).filter((w) => indexed.has(w) && !isStopword(w)))];
  if (repeated.length) warnings.push(`Already indexed from title/subtitle (wasted characters): ${repeated.join(", ")}.`);
  return warnings;
}

function territoryMatcher(codes: string[] | undefined) {
  if (!codes?.length) return () => true;
  const wanted = new Set(codes.flatMap((c) => [c.toUpperCase(), ALPHA3[c.toLowerCase()]?.toUpperCase()].filter(Boolean) as string[]));
  return (p: TerritoryPrice) => wanted.has(p.territory.toUpperCase());
}

export const manageTools = [
  defineTool({
    name: "add_keywords",
    title: "Track keywords",
    layer: "manage",
    write: true,
    description:
      "Start tracking up to 25 search terms for an app in one storefront, then analyze them (popularity, difficulty, rank). Already-tracked terms are kept. Requires write tools to be enabled.",
    input: { appId, terms: z.array(z.string().trim().min(1).max(100)).min(1).max(25), country: optionalCountry },
    run: async ({ appId: id, terms, country: c }) => {
      requireWrites();
      const code = countryFor(id, c);
      const before = new Set(listKeywords(id, code).map((k) => k.term));
      const added = addKeywords(id, terms, code);
      const fresh = added.filter((k) => !k.lastRefreshedAt);
      const refreshed = await refreshKeywords(fresh.map((k) => k.id));
      const failed = refreshed.filter((r) => !r.ok);
      const ids = new Set(added.map((k) => k.id));
      const keywords = listKeywords(id, code).filter((k) => ids.has(k.id));
      return {
        appId: id,
        country: code,
        added: keywords.filter((k) => !before.has(k.term)).length,
        alreadyTracked: terms.map(normalizeTerm).filter((t) => before.has(t)),
        analysisErrors: failed,
        note: ESTIMATE_NOTE,
        keywords: keywords.map(compactKeyword),
      };
    },
  }),
  defineTool({
    name: "remove_keywords",
    title: "Stop tracking keywords",
    layer: "manage",
    write: true,
    description: "Stop tracking keywords (deletes them and their history). All ids must belong to the given app. Requires write tools to be enabled.",
    input: { appId, keywordIds: z.array(z.number().int().positive()).min(1).max(200).describe("Keyword ids from get_app_keywords") },
    run: ({ appId: id, keywordIds }) => {
      requireWrites();
      getApp(id);
      const owned = new Map(listKeywords(id).map((k) => [k.id, k]));
      const foreign = keywordIds.filter((k) => !owned.has(k));
      if (foreign.length) throw new HttpError(400, `These keyword ids do not belong to app ${id}: ${foreign.join(", ")}. Nothing was removed.`);
      const unique = [...new Set(keywordIds)];
      deleteKeywords(unique);
      return { appId: id, removed: unique.map((k) => ({ id: k, term: owned.get(k)?.term, country: owned.get(k)?.country })) };
    },
  }),
  defineTool({
    name: "set_keyword_note",
    title: "Annotate a keyword",
    layer: "manage",
    write: true,
    description: "Set or clear the note on a tracked keyword and optionally mark it as liked (favorite). Requires write tools to be enabled.",
    input: {
      keywordId: z.number().int().positive(),
      note: z.string().max(2000).nullable().describe("Note text, or null to clear"),
      liked: z.boolean().optional(),
    },
    run: ({ keywordId, note, liked }) => {
      requireWrites();
      getKeyword(keywordId);
      return compactKeyword(updateKeyword(keywordId, { notes: note?.trim() ? note.trim() : null, liked }));
    },
  }),
  defineTool({
    name: "get_metadata",
    title: "Get App Store Connect metadata",
    layer: "manage",
    description:
      "Current App Store Connect metadata per locale (title, subtitle, keywords field, promotional text, what's new) with character counts, plus whether the app info and version are editable. Requires App Store Connect to be connected and the app linked.",
    input: {
      appId,
      locale: z.string().trim().min(2).max(10).optional().describe("ASC locale such as en-US or de-DE. Omit for all locales."),
      includeDescription: z.boolean().default(false).describe("Include full description and what's new text"),
    },
    run: async ({ appId: id, locale, includeDescription }) => {
      const meta = await getMetadata(id, locale);
      return {
        ascAppId: meta.ascAppId,
        appName: meta.appName,
        primaryLocale: meta.primaryLocale,
        limits: { title: METADATA_LIMITS.name, subtitle: METADATA_LIMITS.subtitle, keywords: METADATA_LIMITS.keywords },
        appInfo: meta.appInfo,
        version: meta.version,
        liveVersion: meta.liveVersion,
        localizations: meta.localizations.map((l) => localeView(l, includeDescription)),
      };
    },
  }),
  defineTool({
    name: "update_metadata",
    title: "Update title, subtitle or keywords",
    layer: "manage",
    write: true,
    description:
      "Change the title (≤30 chars), subtitle (≤30) and/or keywords field (≤100, comma-separated) of one locale in App Store Connect. Dry run by default: returns a before/after diff and warnings. To apply, show the diff to the user, then call again with dryRun: false and confirm: true. Title/subtitle need an editable app info; keywords need an editable version.",
    input: {
      appId,
      locale: z.string().trim().min(2).max(10).describe("ASC locale such as en-US"),
      title: z.string().max(200).optional(),
      subtitle: z.string().max(200).optional(),
      keywords: z.string().max(400).optional(),
      dryRun,
      confirm,
    },
    run: async (input) => {
      const fields = (Object.keys(FIELD_MAP) as EditableField[]).filter((f) => input[f] !== undefined);
      if (!fields.length) throw new HttpError(400, "Provide at least one of title, subtitle or keywords");
      const next = Object.fromEntries(fields.map((f) => [f, (input[f] as string).trim()])) as Partial<Record<EditableField, string>>;
      for (const f of fields) {
        const max = METADATA_LIMITS[FIELD_MAP[f]];
        if (chars(next[f]) > max) throw new HttpError(422, `${f} is ${chars(next[f])} characters; the limit is ${max}`);
      }
      const meta = await getAppMetadata(input.appId, { refresh: true });
      const current = meta.localizations.find((l) => sameLocale(l.locale, input.locale)) ?? null;
      const diff = fields.map((f) => {
        const before = current?.[FIELD_MAP[f]] ?? null;
        const after = next[f] || null;
        return { field: f, before, after, beforeLength: chars(before), afterLength: chars(after), limit: METADATA_LIMITS[FIELD_MAP[f]], changed: (before ?? "") !== (after ?? "") };
      });
      const blockers: string[] = [];
      if (fields.some((f) => f !== "keywords") && !meta.appInfo?.editable) blockers.push("Title and subtitle can only change while a new version is being prepared (app info is not editable).");
      if (fields.includes("keywords") && !meta.version?.editable) blockers.push(`Keywords can't change: version ${meta.version?.versionString ?? "?"} is ${meta.version?.state ?? "missing"}. Create a new version in App Store Connect first.`);
      if (!current?.appInfoLocalizationId && fields.some((f) => f !== "keywords") && !next.title) blockers.push(`Locale ${input.locale} does not exist yet; a title is required to create it.`);
      const warnings = keywordWarnings({
        title: next.title ?? current?.name ?? null,
        subtitle: next.subtitle ?? current?.subtitle ?? null,
        keywords: next.keywords ?? current?.keywords ?? null,
      });
      const changed = diff.filter((d) => d.changed);
      const summary = { appId: input.appId, locale: current?.locale ?? input.locale, localeExists: !!current, diff, warnings, blockers };
      if (!changed.length) return { ...summary, applied: false, message: "Nothing to change." };
      if (!shouldApply(input)) return { ...summary, applied: false, dryRun: true, message: blockers.length ? "Dry run: this change would be rejected." : "Dry run. Confirm with the user, then call again with dryRun: false and confirm: true." };
      if (blockers.length) throw new HttpError(409, blockers.join(" "));
      const patch: MetadataPatch = Object.fromEntries(changed.map((d) => [FIELD_MAP[d.field], d.after ?? ""]));
      const result = await updateMetadata(input.appId, input.locale, patch);
      return { ...summary, applied: true, result: localeView(result, false) };
    },
  }),
  defineTool({
    name: "get_app_store_page",
    title: "Get public App Store page",
    layer: "manage",
    description: "The public App Store product page as users see it in a storefront: title, subtitle (when tracked), full description, release notes, rating, price and iPhone/iPad screenshot URLs.",
    input: { appId: appId.optional(), trackId: trackId.optional(), country: optionalCountry },
    run: async (input) => {
      const tracked = input.appId ? getApp(input.appId) : input.trackId ? findAppByTrackId(input.trackId) : undefined;
      const id = input.trackId ?? tracked?.trackId;
      if (!id) throw new HttpError(400, "Provide appId or trackId");
      const code = input.country ?? tracked?.primaryCountry ?? "us";
      const app = await lookupApp(id, code);
      if (!app) throw new HttpError(404, `App ${id} is not available in the ${code} storefront`);
      return {
        trackId: app.trackId,
        country: code,
        title: app.trackName,
        subtitle: tracked?.subtitle ?? null,
        developer: app.sellerName,
        genre: app.primaryGenreName,
        price: app.formattedPrice ?? app.price,
        rating: Math.round(app.averageUserRating * 100) / 100,
        ratingCount: app.userRatingCount,
        version: app.version,
        updatedAt: app.currentVersionReleaseDate,
        description: app.description,
        releaseNotes: app.releaseNotes ?? null,
        screenshots: { iphone: app.screenshotUrls ?? [], ipad: app.ipadScreenshotUrls ?? [] },
        url: app.trackViewUrl,
      };
    },
  }),
  defineTool({
    name: "list_products",
    title: "List in-app products",
    layer: "manage",
    description: "Subscriptions and in-app purchases defined in App Store Connect for an app. Use the returned id and kind with get_product_prices. Read-only.",
    input: { appId },
    run: async ({ appId: id }) => ({ appId: id, products: await listProducts(id) }),
  }),
  defineTool({
    name: "get_product_prices",
    title: "Get product prices",
    layer: "manage",
    description: "Current and scheduled prices per territory for one subscription or in-app purchase (customer price and proceeds). Read-only; pricing changes are not available over MCP.",
    input: {
      appId,
      kind: z.enum(["subscription", "iap"]),
      productId: z.string().trim().min(1).describe("App Store Connect resource id from list_products (the id field, not the product identifier)"),
      territories: z.array(z.string().trim().min(2).max(3)).max(200).optional().describe("Filter by country codes, alpha-2 (us) or alpha-3 (USA)"),
    },
    run: async ({ appId: id, kind, productId, territories }) => {
      const prices = await getProductPrices(id, kind, productId);
      const match = territoryMatcher(territories);
      return { ...prices, current: prices.current.filter(match), upcoming: prices.upcoming.filter(match) };
    },
  }),
];
