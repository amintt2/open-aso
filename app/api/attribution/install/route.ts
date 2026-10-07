import { after } from "next/server";
import { bearerToken, requireSecret } from "@/lib/integrations/secrets";
import { logIntegrationEvent } from "@/lib/integrations/log";
import { drainPendingAttribution, installInput, recordInstall, resolvePendingAttribution } from "@/lib/analytics/ingest";
import { HttpError, body, json, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export const POST = route(async (req) => {
  requireSecret("integrations.sdk.token", bearerToken(req), "The Open ASO SDK token");
  const input = await body(req, installInput);
  try {
    const result = recordInstall(input);
    after(async () => {
      if (result.attribution === "pending") await resolvePendingAttribution(result.installId);
      await drainPendingAttribution();
    });
    return json({ ok: true, ...result }, { status: result.created ? 201 : 200 });
  } catch (error) {
    if (error instanceof HttpError) logIntegrationEvent("sdk", "error", "install", error.message);
    throw error;
  }
});
