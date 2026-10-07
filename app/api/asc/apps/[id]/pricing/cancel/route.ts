import { z } from "zod";
import { cancelUpcoming } from "@/lib/asc/pricing";
import { requireWorkspace } from "@/lib/server/context";
import { body, idParam, json, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({ kind: z.enum(["subscription", "iap"]), productId: z.string().regex(/^\d+$/), priceIds: z.array(z.string().min(1)).min(1).max(200) });

export const POST = route<Ctx>(async (req, { params }) => {
  const { workspaceId } = await requireWorkspace("admin");
  const id = await idParam(params);
  const input = await body(req, schema);
  return json(await cancelUpcoming(workspaceId, id, input.kind, input.productId, input.priceIds));
});
