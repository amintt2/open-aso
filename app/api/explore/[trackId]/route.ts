import { exploreApp } from "@/lib/explore/store";
import { countryParam, trackIdParam } from "@/lib/explore/params";
import { requireWorkspace } from "@/lib/server/context";
import { json, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ trackId: string }> };

export const GET = route<Ctx>(async (req, { params }) => {
  const { workspaceId } = await requireWorkspace();
  return json(await exploreApp(workspaceId, await trackIdParam(params), countryParam(req)));
});
