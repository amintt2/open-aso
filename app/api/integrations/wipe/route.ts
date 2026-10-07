import { z } from "zod";
import { assertConfirmation, wipeWorkspace } from "@/lib/integrations/data";
import { requireWorkspace } from "@/lib/server/context";
import { body, json, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export const POST = route(async (req) => {
  const { workspaceId } = await requireWorkspace("admin");
  const { confirm } = await body(req, z.object({ confirm: z.string() }));
  assertConfirmation(confirm);
  await wipeWorkspace(workspaceId);
  return json({ ok: true });
});
