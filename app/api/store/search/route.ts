import { searchApps } from "@/lib/appstore/itunes";
import { HttpError, json, route } from "@/lib/server/http";

export const GET = route(async (req) => {
  const params = new URL(req.url).searchParams;
  const term = params.get("term")?.trim();
  if (!term) throw new HttpError(400, "term is required");
  const country = (params.get("country") ?? "us").toLowerCase();
  const limit = Math.min(200, Number(params.get("limit") ?? 25));
  if (/^\d{6,}$/.test(term)) {
    const { lookupApps } = await import("@/lib/appstore/itunes");
    return json(await lookupApps([Number(term)], country));
  }
  return json(await searchApps(term, country, limit));
});
