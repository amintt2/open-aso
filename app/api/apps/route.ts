import { z } from "zod";
import { addApp, listApps } from "@/lib/aso/apps";
import { startDetection } from "@/lib/keywords/autodetect";
import { body, json, route } from "@/lib/server/http";

export const GET = route(() => json(listApps()));

export const POST = route(async (req) => {
  const input = await body(req, z.object({ trackId: z.number().int(), country: z.string().length(2), isMine: z.boolean().optional() }));
  const app = await addApp(input.trackId, input.country.toLowerCase(), input.isMine ?? true);
  if (app.isMine && app.keywordCount === 0) startDetection(app.id, app.primaryCountry);
  return json(app, { status: 201 });
});
