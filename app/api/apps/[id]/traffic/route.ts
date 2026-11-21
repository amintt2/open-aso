import { requireWorkspace } from "@/lib/server/context";
import { HttpError, idParam, json, route } from "@/lib/server/http";
import { getTraffic, trafficDays } from "@/lib/traffic/service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (req, { params }) => {
  const { workspaceId } = await requireWorkspace();
  const appId = await idParam(params);
  const search = new URL(req.url).searchParams;
  const country = (search.get("country") ?? "all").trim().toLowerCase();
  if (country !== "all" && !/^[a-z]{2}$/.test(country)) throw new HttpError(400, "country must be a two-letter code or all");
  return json(await getTraffic(workspaceId, appId, { days: trafficDays(search.get("days")), country, demo: search.get("demo") === "1" }));
});
