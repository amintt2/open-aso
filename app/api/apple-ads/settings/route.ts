import { z } from "zod";
import { body, json } from "@/lib/server/http";
import { getTargetCpa, setTargetCpa } from "@/lib/apple-ads/service";
import { adsRoute } from "@/lib/apple-ads/http";

export const GET = adsRoute(() => json({ targetCpa: getTargetCpa() }));

export const PUT = adsRoute(async (req) => {
  const input = await body(req, z.object({ targetCpa: z.number().positive().max(100_000).nullable() }));
  return json({ targetCpa: setTargetCpa(input.targetCpa) });
});
