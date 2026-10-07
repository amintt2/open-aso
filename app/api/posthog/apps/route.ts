import { discoverApps } from "@/lib/posthog/apps";
import { requireCredentials } from "@/lib/posthog/client";
import { json, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  requireCredentials();
  return json(await discoverApps({ refresh: new URL(req.url).searchParams.get("refresh") === "1" }));
});
