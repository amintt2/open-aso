import { z } from "zod";
import { requireWorkspace } from "@/lib/server/context";
import { setSetting } from "@/lib/server/settings";
import { integrationsStatus } from "@/lib/integrations/status";
import { body, json, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

const input = z.object({
  superwallSecret: z
    .string()
    .trim()
    .regex(
      /^whsec_[A-Za-z0-9+/=]{16,}$/,
      "Paste the signing secret from Superwall (starts with whsec_)",
    )
    .nullable()
    .optional(),
});

export const PUT = route(async (req) => {
  const { workspaceId } = await requireWorkspace("admin");
  const { superwallSecret } = await body(req, input);
  if (superwallSecret !== undefined)
    await setSetting(
      workspaceId,
      "integrations.superwall.secret",
      superwallSecret,
    );
  return json(await integrationsStatus(workspaceId, true));
});
