import { suggestCompetitors } from "@/lib/competitors/competitors";
import { getApp } from "@/lib/aso/apps";
import { idParam, json, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (req, { params }) => {
  const appId = await idParam(params);
  const country = new URL(req.url).searchParams.get("country") ?? getApp(appId).primaryCountry;
  return json(suggestCompetitors(appId, country));
});
