import { findAppByTrackId } from "@/lib/aso/apps";
import { discoverRankingKeywords } from "@/lib/explore/ranking-keywords";
import { countryParam, trackIdParam } from "@/lib/explore/params";
import { requireWorkspace } from "@/lib/server/context";
import { json, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ trackId: string }> };

export const maxDuration = 300;

export const GET = route<Ctx>(async (req, { params }) => {
  const { workspaceId } = await requireWorkspace();
  const trackId = await trackIdParam(params);
  const tracked = await findAppByTrackId(workspaceId, trackId);
  return json(await discoverRankingKeywords(trackId, countryParam(req), tracked?.subtitle ?? null));
});
