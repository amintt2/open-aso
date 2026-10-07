import { z } from "zod";
import { body, json } from "@/lib/server/http";
import { createKeys, getConnection } from "@/lib/apple-ads/connection";
import { adsRoute } from "@/lib/apple-ads/http";

export const POST = adsRoute(async (req) => {
  const input = await body(req, z.object({ privateKey: z.string().min(40).max(5000).optional(), force: z.boolean().optional() }));
  const { publicKey } = createKeys(input);
  return json({ publicKey, connection: getConnection() }, { status: 201 });
});
