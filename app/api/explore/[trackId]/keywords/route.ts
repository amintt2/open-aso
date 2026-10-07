import { discoverRankingKeywords } from "@/lib/explore/ranking-keywords";
import { countryParam, trackIdParam } from "@/lib/explore/params";
import { json, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ trackId: string }> };

export const maxDuration = 300;

export const GET = route<Ctx>(async (req, { params }) => json(await discoverRankingKeywords(await trackIdParam(params), countryParam(req))));
