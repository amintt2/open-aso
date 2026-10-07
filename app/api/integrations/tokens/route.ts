import { z } from "zod";
import {
  INTEGRATION_TOKEN_KINDS,
  revokeToken,
  rotateToken,
} from "@/lib/integrations/secrets";
import { requireWorkspace } from "@/lib/server/context";
import { body, json, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

const input = z.object({
  kind: z.enum(INTEGRATION_TOKEN_KINDS),
  action: z.enum(["rotate", "revoke"]),
});

export const POST = route(async (req) => {
  const { workspaceId } = await requireWorkspace("admin");
  const { kind, action } = await body(req, input);
  if (action === "revoke") {
    await revokeToken(workspaceId, kind);
    return json({ ok: true, token: null });
  }
  return json(
    { ok: true, token: await rotateToken(workspaceId, kind) },
    { headers: { "Cache-Control": "no-store" } },
  );
});
