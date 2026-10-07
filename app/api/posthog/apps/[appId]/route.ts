import { z } from "zod";
import { deleteMapping, setMapping } from "@/lib/posthog/apps";
import { requireWorkspace } from "@/lib/server/context";
import { body, idParam, json, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<Record<string, string>> };

const input = z.object({
  bundleId: z.string().trim().max(255).nullish(),
  prefix: z.string().trim().max(64).nullish(),
});

export const PUT = route(async (req, { params }: Ctx) => {
  const { workspaceId } = await requireWorkspace("admin");
  const appId = await idParam(params, "appId");
  return json(await setMapping(workspaceId, appId, await body(req, input)));
});

export const DELETE = route(async (_req, { params }: Ctx) => {
  const { workspaceId } = await requireWorkspace("admin");
  await deleteMapping(workspaceId, await idParam(params, "appId"));
  return json({ ok: true });
});
