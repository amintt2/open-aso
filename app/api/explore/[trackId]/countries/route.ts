import { countryPresence } from "@/lib/explore/store";
import { trackIdParam } from "@/lib/explore/params";
import { requireWorkspace } from "@/lib/server/context";
import { json, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ trackId: string }> };

export const maxDuration = 300;

export const GET = route<Ctx>(async (_req, { params }) => {
  await requireWorkspace();
  return json(await countryPresence(await trackIdParam(params)));
});
