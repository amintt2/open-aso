import { compareKeywords, getCompetitor } from "@/lib/competitors/competitors";
import { idParam, json, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

export const maxDuration = 300;

export const GET = route<Ctx>(async (req, { params }) => {
  const id = await idParam(params);
  const country = new URL(req.url).searchParams.get("country") ?? (await getCompetitor(id)).country;
  return json(await compareKeywords(id, country));
});
