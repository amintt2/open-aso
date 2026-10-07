import { z } from "zod";
import { body, json } from "@/lib/server/http";
import { requireWorkspace } from "@/lib/server/context";
import { getTargetCpa, setTargetCpa } from "@/lib/apple-ads/service";
import { adsRoute } from "@/lib/apple-ads/http";

export const GET = adsRoute(async () => {
  const { workspaceId } = await requireWorkspace();
  return json({ targetCpa: await getTargetCpa(workspaceId) });
});

export const PUT = adsRoute(async (req) => {
  const { workspaceId } = await requireWorkspace("admin");
  const input = await body(req, z.object({ targetCpa: z.number().positive().max(100_000).nullable() }));
  return json({ targetCpa: await setTargetCpa(workspaceId, input.targetCpa) });
});
