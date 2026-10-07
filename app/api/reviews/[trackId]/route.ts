import { loadReviews } from "@/lib/reviews/reviews";
import { scopeParam } from "@/lib/reviews/params";
import { trackIdParam } from "@/lib/explore/params";
import { json, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ trackId: string }> };

export const maxDuration = 120;

export const GET = route<Ctx>(async (req, { params }) => {
  const trackId = await trackIdParam(params);
  return json(await loadReviews(trackId, scopeParam(new URL(req.url).searchParams.get("country"))));
});
