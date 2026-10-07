import { z } from "zod";
import { addKeywords, deleteKeywords, listKeywords, refreshKeywords } from "@/lib/aso/keywords";
import { requireWorkspace } from "@/lib/server/context";
import { body, idParam, json, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (req, { params }) => {
  const { workspaceId } = await requireWorkspace();
  const country = new URL(req.url).searchParams.get("country") ?? undefined;
  return json(await listKeywords(workspaceId, await idParam(params), country));
});

export const POST = route<Ctx>(async (req, { params }) => {
  const { workspaceId } = await requireWorkspace();
  const appId = await idParam(params);
  const input = await body(
    req,
    z.object({ terms: z.array(z.string().min(1).max(100)).min(1).max(200), country: z.string().length(2), analyze: z.boolean().optional() }),
  );
  const country = input.country.toLowerCase();
  const added = await addKeywords(workspaceId, appId, input.terms, country);
  if (input.analyze !== false) await refreshKeywords(workspaceId, added.filter((k) => !k.lastRefreshedAt).map((k) => k.id));
  return json(await listKeywords(workspaceId, appId, country), { status: 201 });
});

export const DELETE = route<Ctx>(async (req) => {
  const { workspaceId } = await requireWorkspace();
  const input = await body(req, z.object({ ids: z.array(z.number().int()).min(1) }));
  await deleteKeywords(workspaceId, input.ids);
  return json({ ok: true });
});
