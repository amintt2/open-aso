import { z } from "zod";
import { appCatalog, setOverride } from "@/lib/posthog/apps";
import { requireCredentials } from "@/lib/posthog/client";
import { EVENT_ROLES } from "@/lib/posthog/types";
import { requireWorkspace } from "@/lib/server/context";
import { body, idParam, json, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<Record<string, string>> };

const input = z.object({
  role: z.enum(EVENT_ROLES),
  events: z.array(z.string().trim().min(1).max(200)).max(20).nullable(),
});

export const GET = route(async (req, { params }: Ctx) => {
  const { workspaceId } = await requireWorkspace();
  const appId = await idParam(params, "appId");
  await requireCredentials(workspaceId);
  return json(
    await appCatalog(workspaceId, appId, {
      refresh: new URL(req.url).searchParams.get("refresh") === "1",
    }),
  );
});

export const PUT = route(async (req, { params }: Ctx) => {
  const { workspaceId } = await requireWorkspace("admin");
  const appId = await idParam(params, "appId");
  const { role, events } = await body(req, input);
  await requireCredentials(workspaceId);
  await setOverride(workspaceId, appId, role, events);
  return json(await appCatalog(workspaceId, appId));
});
