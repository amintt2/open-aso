import { json } from "@/lib/server/http";
import { requireWorkspace } from "@/lib/server/context";
import { getKeywordTrend } from "@/lib/apple-ads/service";
import { adsRoute, searchOpts, segment } from "@/lib/apple-ads/http";

type Ctx = { params: Promise<{ keywordId: string }> };

export const GET = adsRoute<Ctx>(async (req, { params }) => {
  const { workspaceId } = await requireWorkspace();
  return json(await getKeywordTrend(workspaceId, await segment(params, "keywordId"), { demo: searchOpts(req).demo }));
});
