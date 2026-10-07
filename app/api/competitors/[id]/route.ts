import { deleteCompetitor, getCompetitor } from "@/lib/competitors/competitors";
import { requireWorkspace } from "@/lib/server/context";
import { idParam, json, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (req, { params }) => {
  const { workspaceId } = await requireWorkspace();
  const country = new URL(req.url).searchParams.get("country") ?? undefined;
  return json(await getCompetitor(workspaceId, await idParam(params), country));
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const { workspaceId } = await requireWorkspace();
  await deleteCompetitor(workspaceId, await idParam(params));
  return json({ ok: true });
});
