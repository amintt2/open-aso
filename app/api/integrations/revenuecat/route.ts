import { handleRevenueCat } from "@/lib/integrations/revenuecat";
import { bearer, workspaceForToken } from "@/lib/server/tokens";
import { HttpError, json, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export const POST = route(async (req) => {
  const workspaceId = await workspaceForToken("revenuecat", bearer(req));
  if (!workspaceId)
    throw new HttpError(
      401,
      "Unauthorized: set the webhook's Authorization header to this workspace's RevenueCat token",
    );
  const payload = await req.json().catch(() => {
    throw new HttpError(400, "Body must be JSON");
  });
  return json(
    await handleRevenueCat(
      workspaceId,
      payload,
      new URL(req.url).searchParams.get("app"),
    ),
  );
});
