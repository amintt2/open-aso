import { z } from "zod";
import { buildPricingPlan } from "@/lib/asc/pricing";
import { requireWorkspace } from "@/lib/server/context";
import { body, idParam, json, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  kind: z.enum(["subscription", "iap"]),
  productId: z.string().regex(/^\d+$/),
  baseUsd: z.number().positive().max(10000),
  strategy: z.enum(["ppp", "equalized"]),
  clampMin: z.number().min(0.05).max(2).optional(),
  clampMax: z.number().min(0.05).max(3).optional(),
});

export const POST = route<Ctx>(async (req, { params }) => {
  const { workspaceId } = await requireWorkspace();
  const id = await idParam(params);
  return json(await buildPricingPlan(workspaceId, id, await body(req, schema)));
});
