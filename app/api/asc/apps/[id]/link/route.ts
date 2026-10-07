import { z } from "zod";
import { linkAscApp, unlinkAscApp } from "@/lib/asc/apps";
import { clearAscCache } from "@/lib/asc/client";
import { requireWorkspace } from "@/lib/server/context";
import { body, idParam, json, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (req, { params }) => {
  const { workspaceId } = await requireWorkspace();
  const id = await idParam(params);
  const input = await body(req, z.object({ ascAppId: z.string().regex(/^\d+$/).optional() }));
  const app = await linkAscApp(workspaceId, id, input.ascAppId);
  if (app.ascAppId) await clearAscCache(workspaceId, `asc:app:${app.ascAppId}:`);
  return json(app);
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const { workspaceId } = await requireWorkspace();
  return json(await unlinkAscApp(workspaceId, await idParam(params)));
});
