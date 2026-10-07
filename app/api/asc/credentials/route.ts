import { z } from "zod";
import { clearAscCredentials, getAscStatus, saveAscCredentials } from "@/lib/asc/status";
import { requireWorkspace } from "@/lib/server/context";
import { body, json, route } from "@/lib/server/http";

const schema = z.object({
  issuerId: z.string().trim().min(8, "Issuer ID looks too short"),
  keyId: z.string().trim().min(4, "Key ID looks too short"),
  privateKey: z.string().max(10000).nullable().optional(),
  dryRun: z.boolean().optional(),
});

export const PUT = route(async (req) => {
  const { workspaceId } = await requireWorkspace("admin");
  const input = await body(req, schema);
  const result = await saveAscCredentials(workspaceId, input, { dryRun: input.dryRun });
  if (input.dryRun) return json(result);
  return json({ ...result, status: await getAscStatus(workspaceId, { refresh: true }) });
});

export const DELETE = route(async () => {
  const { workspaceId } = await requireWorkspace("admin");
  await clearAscCredentials(workspaceId);
  return json({ ok: true });
});
