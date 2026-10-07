import { discoverApps } from "@/lib/posthog/apps";
import { requireCredentials } from "@/lib/posthog/client";
import { requireWorkspace } from "@/lib/server/context";
import { json, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  const { workspaceId } = await requireWorkspace();
  await requireCredentials(workspaceId);
  return json(
    await discoverApps(workspaceId, {
      refresh: new URL(req.url).searchParams.get("refresh") === "1",
    }),
  );
});
