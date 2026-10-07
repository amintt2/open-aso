import { z } from "zod";
import { isCountry } from "@/lib/appstore/countries";
import { publicJob } from "@/lib/suggestions/jobs";
import { startSuggestions, suggestionsOverview } from "@/lib/suggestions/run";
import { body, HttpError, json, route } from "@/lib/server/http";

function countryOf(value: string | null | undefined) {
  const c = (value ?? "").toLowerCase();
  if (!isCountry(c)) throw new HttpError(400, "Unsupported country");
  return c;
}

export const GET = route(async (req) => {
  const params = new URL(req.url).searchParams;
  const appId = Number(params.get("appId"));
  if (!Number.isInteger(appId) || appId <= 0) throw new HttpError(400, "appId is required");
  return json(suggestionsOverview(appId, countryOf(params.get("country"))));
});

export const POST = route(async (req) => {
  const input = await body(req, z.object({ appId: z.number().int().positive(), country: z.string().length(2), useAi: z.boolean().optional() }));
  const job = startSuggestions(input.appId, countryOf(input.country), input.useAi ?? false);
  return json(publicJob(job), { status: 202 });
});
