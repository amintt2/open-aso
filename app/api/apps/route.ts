import { z } from "zod";
import { addApp, listApps } from "@/lib/aso/apps";
import { body, json, route } from "@/lib/server/http";

export const GET = route(() => json(listApps()));

export const POST = route(async (req) => {
  const input = await body(req, z.object({ trackId: z.number().int(), country: z.string().length(2), isMine: z.boolean().optional() }));
  return json(await addApp(input.trackId, input.country.toLowerCase(), input.isMine ?? true), { status: 201 });
});
