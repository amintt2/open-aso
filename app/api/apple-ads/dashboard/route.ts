import { json } from "@/lib/server/http";
import { getDashboard } from "@/lib/apple-ads/service";
import { adsRoute, searchOpts } from "@/lib/apple-ads/http";

export const GET = adsRoute(async (req) => json(await getDashboard(searchOpts(req))));
