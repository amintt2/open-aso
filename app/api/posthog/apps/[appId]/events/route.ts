import { z } from "zod";
import { appCatalog, setOverride } from "@/lib/posthog/apps";
import { requireCredentials } from "@/lib/posthog/client";
import { EVENT_ROLES } from "@/lib/posthog/types";
import { body, idParam, json, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<Record<string, string>> };

const input = z.object({ role: z.enum(EVENT_ROLES), events: z.array(z.string().trim().min(1).max(200)).max(20).nullable() });

export const GET = route(async (req, { params }: Ctx) => {
  const appId = await idParam(params, "appId");
  requireCredentials();
  return json(await appCatalog(appId, { refresh: new URL(req.url).searchParams.get("refresh") === "1" }));
});

export const PUT = route(async (req, { params }: Ctx) => {
  const appId = await idParam(params, "appId");
  const { role, events } = await body(req, input);
  requireCredentials();
  setOverride(appId, role, events);
  return json(await appCatalog(appId));
});
