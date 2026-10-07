import { z } from "zod";
import { revokeToken, rotateToken } from "@/lib/integrations/secrets";
import { body, json, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

const input = z.object({ kind: z.enum(["revenuecat", "sdk"]), action: z.enum(["rotate", "revoke"]) });

export const POST = route(async (req) => {
  const { kind, action } = await body(req, input);
  if (action === "revoke") {
    revokeToken(kind);
    return json({ ok: true, token: null });
  }
  return json({ ok: true, token: rotateToken(kind) }, { headers: { "Cache-Control": "no-store" } });
});
