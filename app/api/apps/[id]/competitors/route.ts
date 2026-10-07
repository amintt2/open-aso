import { z } from "zod";
import { addCompetitor, listCompetitors } from "@/lib/competitors/competitors";
import { getApp } from "@/lib/aso/apps";
import { requireWorkspace } from "@/lib/server/context";
import { body, idParam, json, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (req, { params }) => {
  const { workspaceId } = await requireWorkspace();
  const appId = await idParam(params);
  const country = new URL(req.url).searchParams.get("country") ?? (await getApp(workspaceId, appId)).primaryCountry;
  return json(await listCompetitors(workspaceId, appId, country));
});

export const POST = route<Ctx>(async (req, { params }) => {
  const { workspaceId } = await requireWorkspace();
  const appId = await idParam(params);
  const input = await body(req, z.object({ trackId: z.number().int().positive(), country: z.string().length(2).optional() }));
  const country = (input.country ?? (await getApp(workspaceId, appId)).primaryCountry).toLowerCase();
  return json(await addCompetitor(workspaceId, appId, input.trackId, country), { status: 201 });
});
