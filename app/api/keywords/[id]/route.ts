import { z } from "zod";
import { getKeyword, updateKeyword } from "@/lib/aso/keywords";
import { body, idParam, json, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_req, { params }) => json(getKeyword(await idParam(params))));

export const PATCH = route<Ctx>(async (req, { params }) => {
  const patch = await body(req, z.object({ notes: z.string().max(2000).nullable().optional(), liked: z.boolean().optional() }));
  return json(updateKeyword(await idParam(params), patch));
});
