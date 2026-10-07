import { z } from "zod";
import { getKeyword, updateKeyword } from "@/lib/aso/keywords";
import { requireWorkspace } from "@/lib/server/context";
import { body, idParam, json, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  const { workspaceId } = await requireWorkspace();
  return json(await getKeyword(workspaceId, await idParam(params)));
});

export const PATCH = route<Ctx>(async (req, { params }) => {
  const { workspaceId } = await requireWorkspace();
  const patch = await body(req, z.object({ notes: z.string().max(2000).nullable().optional(), liked: z.boolean().optional() }));
  return json(await updateKeyword(workspaceId, await idParam(params), patch));
});
