import { z } from "zod";
import { scheduleIapPrices, scheduleSubscriptionPrices } from "@/lib/asc/pricing";
import { body, idParam, json, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  kind: z.enum(["subscription", "iap"]),
  productId: z.string().regex(/^\d+$/),
  rows: z.array(z.object({ territory: z.string().length(3), pricePointId: z.string().min(1), increase: z.boolean() })).min(1).max(200),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  preserveCurrentPrice: z.boolean().optional(),
});

export const POST = route<Ctx>(async (req, { params }) => {
  const id = await idParam(params);
  const input = await body(req, schema);
  if (input.kind === "iap") return json(await scheduleIapPrices(id, input.productId, input.rows, { startDate: input.startDate }));
  return json(await scheduleSubscriptionPrices(id, input.productId, input.rows, { startDate: input.startDate, preserveCurrentPrice: !!input.preserveCurrentPrice }));
});
