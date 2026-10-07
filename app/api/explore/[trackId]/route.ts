import { exploreApp } from "@/lib/explore/store";
import { countryParam, trackIdParam } from "@/lib/explore/params";
import { json, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ trackId: string }> };

export const GET = route<Ctx>(async (req, { params }) => json(await exploreApp(await trackIdParam(params), countryParam(req))));
