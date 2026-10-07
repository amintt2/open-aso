import { json } from "@/lib/server/http";
import { getKeywordTrend } from "@/lib/apple-ads/service";
import { adsRoute, searchOpts, segment } from "@/lib/apple-ads/http";

type Ctx = { params: Promise<{ keywordId: string }> };

export const GET = adsRoute<Ctx>(async (req, { params }) => json(await getKeywordTrend(await segment(params, "keywordId"), { demo: searchOpts(req).demo })));
