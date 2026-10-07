import { z } from "zod";
import { getProductPrices } from "@/lib/asc/pricing";
import { idParam, json, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({ kind: z.enum(["subscription", "iap"]), productId: z.string().regex(/^\d+$/), refresh: z.string().optional() });

export const GET = route<Ctx>(async (req, { params }) => {
  const id = await idParam(params);
  const input = schema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return json(await getProductPrices(id, input.kind, input.productId, { refresh: input.refresh === "1" }));
});
