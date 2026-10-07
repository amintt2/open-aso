import { z } from "zod";
import { removeCredentials, saveCredentials } from "@/lib/posthog/client";
import { posthogStatus } from "@/lib/posthog/status";
import { requireWorkspace } from "@/lib/server/context";
import { body, json, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

const input = z.object({
  region: z.enum(["us", "eu", "custom"]),
  host: z.string().trim().max(500).nullish(),
  projectId: z
    .union([z.string(), z.number().int().positive()])
    .transform((v) => String(v)),
  apiKey: z.string().trim().max(500).nullish(),
});

export const PUT = route(async (req) => {
  const { workspaceId } = await requireWorkspace("admin");
  const check = await saveCredentials(workspaceId, await body(req, input));
  return json({
    status: { ...(await posthogStatus(workspaceId)), canManage: true },
    check,
  });
});

export const DELETE = route(async () => {
  const { workspaceId } = await requireWorkspace("admin");
  await removeCredentials(workspaceId);
  return json({
    status: { ...(await posthogStatus(workspaceId)), canManage: true },
  });
});
