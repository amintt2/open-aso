import { z } from "zod";
import { isCountry } from "@/lib/appstore/countries";
import { getApp } from "@/lib/aso/apps";
import { pruneCandidates, pruneKeywords } from "@/lib/keywords/prune";
import { requireWorkspace } from "@/lib/server/context";
import { body, HttpError, idParam, json, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

function countryOf(value: string | null | undefined) {
  if (!value || value.toLowerCase() === "all") return undefined;
  const country = value.toLowerCase();
  if (!isCountry(country)) throw new HttpError(400, "Unsupported country");
  return country;
}

export const GET = route<Ctx>(async (req, { params }) => {
  const { workspaceId } = await requireWorkspace();
  const appId = await idParam(params);
  await getApp(workspaceId, appId);
  return json(await pruneCandidates(workspaceId, appId, countryOf(new URL(req.url).searchParams.get("country"))));
});

export const POST = route<Ctx>(async (req, { params }) => {
  const { workspaceId } = await requireWorkspace();
  const appId = await idParam(params);
  const input = await body(req, z.object({ country: z.string().min(2).max(3).optional(), ids: z.array(z.number().int()).min(1).max(20000).optional() }));
  await getApp(workspaceId, appId);
  return json(await pruneKeywords(workspaceId, appId, { country: countryOf(input.country), apply: true, ids: input.ids }));
});
