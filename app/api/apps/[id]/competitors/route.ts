import { z } from "zod";
import { addCompetitor, listCompetitors } from "@/lib/competitors/competitors";
import { getApp } from "@/lib/aso/apps";
import { body, idParam, json, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (req, { params }) => {
  const appId = await idParam(params);
  const country = new URL(req.url).searchParams.get("country") ?? getApp(appId).primaryCountry;
  return json(await listCompetitors(appId, country));
});

export const POST = route<Ctx>(async (req, { params }) => {
  const appId = await idParam(params);
  const input = await body(req, z.object({ trackId: z.number().int().positive(), country: z.string().length(2).optional() }));
  const country = (input.country ?? getApp(appId).primaryCountry).toLowerCase();
  return json(await addCompetitor(appId, input.trackId, country), { status: 201 });
});
