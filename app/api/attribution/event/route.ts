import { bearerToken, requireSecret } from "@/lib/integrations/secrets";
import { eventInput, recordEvent } from "@/lib/analytics/ingest";
import { body, json, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export const POST = route(async (req) => {
  requireSecret("integrations.sdk.token", bearerToken(req), "The Open ASO SDK token");
  const input = await body(req, eventInput);
  recordEvent(input);
  return json({ ok: true });
});
