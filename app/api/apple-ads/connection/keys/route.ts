import { z } from "zod";
import { body, json } from "@/lib/server/http";
import { requireWorkspace } from "@/lib/server/context";
import { createKeys, getConnection } from "@/lib/apple-ads/connection";
import { adsRoute } from "@/lib/apple-ads/http";

export const POST = adsRoute(async (req) => {
  const { workspaceId } = await requireWorkspace("admin");
  const input = await body(req, z.object({ privateKey: z.string().min(40).max(5000).optional(), force: z.boolean().optional() }));
  const { publicKey } = await createKeys(workspaceId, input);
  return json({ publicKey, connection: await getConnection(workspaceId) }, { status: 201 });
});
