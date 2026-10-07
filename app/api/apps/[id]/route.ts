import { z } from "zod";
import { deleteApp, getApp, updateApp } from "@/lib/aso/apps";
import { requireWorkspace } from "@/lib/server/context";
import { body, idParam, json, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  const { workspaceId } = await requireWorkspace();
  return json(await getApp(workspaceId, await idParam(params)));
});

export const PATCH = route<Ctx>(async (req, { params }) => {
  const { workspaceId } = await requireWorkspace();
  const id = await idParam(params);
  const patch = await body(
    req,
    z.object({
      primaryCountry: z.string().length(2).optional(),
      subtitle: z.string().max(30).nullable().optional(),
      ascAppId: z.string().nullable().optional(),
      isMine: z.boolean().optional(),
    }),
  );
  return json(await updateApp(workspaceId, id, patch));
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const { workspaceId } = await requireWorkspace("admin");
  await deleteApp(workspaceId, await idParam(params));
  return json({ ok: true });
});
