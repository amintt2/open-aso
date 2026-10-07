import { z } from "zod";
import { addApp, listApps } from "@/lib/aso/apps";
import { startDetection } from "@/lib/keywords/autodetect";
import { requireWorkspace } from "@/lib/server/context";
import { body, json, route } from "@/lib/server/http";

export const GET = route(async () => {
  const { workspaceId } = await requireWorkspace();
  return json(await listApps(workspaceId));
});

export const POST = route(async (req) => {
  const { workspaceId } = await requireWorkspace();
  const input = await body(req, z.object({ trackId: z.number().int(), country: z.string().length(2), isMine: z.boolean().optional() }));
  const app = await addApp(workspaceId, input.trackId, input.country.toLowerCase(), input.isMine ?? true);
  if (app.isMine && app.keywordCount === 0) startDetection(workspaceId, app.id, app.primaryCountry);
  return json(app, { status: 201 });
});
