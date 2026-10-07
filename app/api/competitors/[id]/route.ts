import { deleteCompetitor, getCompetitor } from "@/lib/competitors/competitors";
import { idParam, json, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (req, { params }) => {
  const country = new URL(req.url).searchParams.get("country") ?? undefined;
  return json(await getCompetitor(await idParam(params), country));
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  deleteCompetitor(await idParam(params));
  return json({ ok: true });
});
