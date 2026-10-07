import { z } from "zod";
import { body, json } from "@/lib/server/http";
import { disconnect, getConnection, knownOrgs, saveConnection } from "@/lib/apple-ads/connection";
import { adsRoute } from "@/lib/apple-ads/http";

export const GET = adsRoute(() => json({ connection: getConnection(), orgs: knownOrgs() }));

export const PUT = adsRoute(async (req) => {
  const input = await body(
    req,
    z.object({
      clientId: z.string().trim().min(1).max(200).optional(),
      teamId: z.string().trim().min(1).max(200).optional(),
      keyId: z.string().trim().min(1).max(200).optional(),
      orgId: z.string().regex(/^\d+$/).nullable().optional(),
    }),
  );
  return json({ connection: saveConnection(input), orgs: knownOrgs() });
});

export const DELETE = adsRoute(async (req) => {
  const keepKeys = new URL(req.url).searchParams.get("keepKeys") !== "0";
  return json({ connection: disconnect(keepKeys), orgs: [] });
});
