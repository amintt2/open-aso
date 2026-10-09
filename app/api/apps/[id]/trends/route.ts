import { isCountry } from "@/lib/appstore/countries";
import { requireWorkspace } from "@/lib/server/context";
import { HttpError, idParam, json, route } from "@/lib/server/http";
import { getTrends } from "@/lib/trends/service";
import { TREND_DAYS, type TrendDays } from "@/lib/trends/types";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (req, { params }) => {
  const { workspaceId } = await requireWorkspace();
  const appId = await idParam(params);
  const search = new URL(req.url).searchParams;
  const country = (search.get("country") ?? "all").trim().toLowerCase();
  if (country !== "all" && !isCountry(country)) throw new HttpError(400, "Unsupported country");
  const days = Number(search.get("days") ?? 30) as TrendDays;
  if (!TREND_DAYS.includes(days)) throw new HttpError(400, `days must be one of ${TREND_DAYS.join(", ")}`);
  const keywordIds = (search.get("keywordIds") ?? "")
    .split(",")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);
  return json(await getTrends(workspaceId, appId, { country, days, keywordIds, includeAll: search.get("include") === "all" }));
});
