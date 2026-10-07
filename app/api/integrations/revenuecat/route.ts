import { bearerToken, requireSecret } from "@/lib/integrations/secrets";
import { logIntegrationEvent } from "@/lib/integrations/log";
import { handleRevenueCat } from "@/lib/integrations/revenuecat";
import { HttpError, json, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export const POST = route(async (req) => {
  try {
    requireSecret("integrations.revenuecat.token", bearerToken(req), "The RevenueCat webhook token");
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) logIntegrationEvent("revenuecat", "error", null, "Rejected webhook: Authorization header does not match");
    throw error;
  }
  const payload = await req.json().catch(() => {
    throw new HttpError(400, "Body must be JSON");
  });
  return json(handleRevenueCat(payload, new URL(req.url).searchParams.get("app")));
});
