import { isCountry } from "@/lib/appstore/countries";
import { lookupApps, searchApps } from "@/lib/appstore/itunes";
import { requireUser } from "@/lib/server/context";
import { HttpError, json, route } from "@/lib/server/http";

export const GET = route(async (req) => {
  await requireUser();
  const params = new URL(req.url).searchParams;
  const term = params.get("term")?.trim();
  if (!term) throw new HttpError(400, "term is required");
  if (term.length > 200) throw new HttpError(400, "term is too long");
  const country = (params.get("country") ?? "us").toLowerCase();
  if (!isCountry(country)) throw new HttpError(400, "Unsupported country");
  const limit = Math.min(200, Math.max(1, Number(params.get("limit") ?? 25) || 25));
  if (/^\d{6,}$/.test(term)) return json(await lookupApps([Number(term)], country));
  return json(await searchApps(term, country, limit));
});
