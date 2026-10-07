import { analyzeKeyword } from "@/lib/aso/analyze";
import { HttpError, json, route } from "@/lib/server/http";

export const GET = route(async (req) => {
  const params = new URL(req.url).searchParams;
  const term = params.get("term")?.trim();
  if (!term) throw new HttpError(400, "term is required");
  const trackId = params.get("trackId") ? Number(params.get("trackId")) : undefined;
  return json(await analyzeKeyword(term, (params.get("country") ?? "us").toLowerCase(), trackId));
});
