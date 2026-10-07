import { isCountry } from "@/lib/appstore/countries";
import { analyzeKeyword } from "@/lib/aso/analyze";
import { requireUser } from "@/lib/server/context";
import { HttpError, json, route } from "@/lib/server/http";

export const GET = route(async (req) => {
  await requireUser();
  const params = new URL(req.url).searchParams;
  const term = params.get("term")?.trim();
  if (!term) throw new HttpError(400, "term is required");
  if (term.length > 100) throw new HttpError(400, "term is too long");
  const country = (params.get("country") ?? "us").toLowerCase();
  if (!isCountry(country)) throw new HttpError(400, "Unsupported country");
  const trackId = params.get("trackId") ? Number(params.get("trackId")) : undefined;
  return json(await analyzeKeyword(term, country, trackId && Number.isInteger(trackId) ? trackId : undefined));
});
