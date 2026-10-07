import { z } from "zod";
import { addKeywords, deleteKeywords, listKeywords, refreshKeywords } from "@/lib/aso/keywords";
import { body, idParam, json, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (req, { params }) => {
  const country = new URL(req.url).searchParams.get("country") ?? undefined;
  return json(listKeywords(await idParam(params), country));
});

export const POST = route<Ctx>(async (req, { params }) => {
  const appId = await idParam(params);
  const input = await body(
    req,
    z.object({ terms: z.array(z.string().min(1).max(100)).min(1).max(200), country: z.string().length(2), analyze: z.boolean().optional() }),
  );
  const added = addKeywords(appId, input.terms, input.country.toLowerCase());
  if (input.analyze !== false) await refreshKeywords(added.filter((k) => !k.lastRefreshedAt).map((k) => k.id));
  return json(listKeywords(appId, input.country.toLowerCase()), { status: 201 });
});

export const DELETE = route<Ctx>(async (req) => {
  const input = await body(req, z.object({ ids: z.array(z.number().int()).min(1) }));
  deleteKeywords(input.ids);
  return json({ ok: true });
});
